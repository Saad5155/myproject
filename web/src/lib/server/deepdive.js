// Deep-dive report assembly (server-side).
//   PRIMARY: real financial statements from Alpha Vantage (+ Finnhub quote/peers),
//            with ONE Claude web-search call to fill only what free APIs lack
//            (analyst target range/trend, recent rating actions, peer metrics, YTD, catalysts).
//   FALLBACK: full AI web-search report when AV has no key / is rate-limited.
import 'server-only'
import { getQuote, getFundamentals, LIVE, AI } from './providers'
import { askClaudeWithSearch, parseJSONLoose, aiConfigured } from './anthropic'
import { isDemo, demoDeepDive } from './demo'

const FULL_REPORT_SPEC = `Return ONLY a JSON object, no prose, no code fences, with this exact shape (use null for anything unavailable):
{"ticker":str,"name":str,"description":str (2 lines, what the company does),"sector":str,"marketCap":num,
"price":num,"change":num,"changePct":num,"week52Low":num,"week52High":num,
"financials":{"annual":[{"year":num,"revenue":num,"netIncome":num,"eps":num,"fcf":num,"grossMargin":num,"operatingMargin":num,"netMargin":num}] (last 5 years, oldest first),
"quarterly":[{"period":"Q_'YY","revenue":num,"netIncome":num,"eps":num,"fcf":num}] (last 4-8 quarters, oldest first)},
"growth":{"revenueYoY":num},
"balance":{"cash":num,"totalDebt":num},
"valuation":{"peTrailing":num,"peForward":num,"peg":num,"ps":num,"roe":num,"divYield":num},
"analysts":{"consensus":str,"buy":num,"hold":num,"sell":num,"targetLow":num,"targetAvg":num,"targetHigh":num,
"recent":[{"date":"YYYY-MM-DD","firm":str,"action":"upgrade"|"downgrade"|"initiate"|"maintain","note":str}]},
"peers":[{"ticker":str,"name":str,"revenueGrowthPct":num,"pe":num,"netMarginPct":num}] (2-3 main competitors),
"screener":{"peg":num,"revenueGrowthPct":num,"netIncome":num,"cash":num,"debt":num,"nextCatalyst":{"date":"YYYY-MM-DD","event":str},"targetsTrend":"raised"|"lowered"|"flat","ytdReturnPct":num}}
All monetary values in raw USD (not millions).`

function gapSpec(sym, needPeers) {
  const peerPart = needPeers
    ? ` (5) Identify the 2-3 main competitors of ${sym} with revenue growth %, trailing P/E, and net margin % — include as "peers":[{"ticker":str,"name":str,"revenueGrowthPct":num,"pe":num,"netMarginPct":num}].`
    : ''
  return (
    `For stock ${sym}, find quickly with web search (2-3 searches max, don't over-verify): ` +
    `(1) current analyst price target range (low/average/high) and whether targets were recently RAISED, LOWERED, or FLAT; ` +
    `(2) the 2-3 most recent analyst rating actions (date, firm, action, one-line note); ` +
    `(3) the next dated catalyst in the coming 1-3 months (earnings date, product event, regulatory decision); ` +
    `(4) year-to-date stock price return in %.${peerPart} ` +
    `Return ONLY JSON, no prose: {"targetLow":num,"targetAvg":num,"targetHigh":num,` +
    `"targetsTrend":"raised"|"lowered"|"flat","recent":[{"date":"YYYY-MM-DD","firm":str,"action":"upgrade"|"downgrade"|"initiate"|"maintain","note":str}],` +
    `"nextCatalyst":{"date":"YYYY-MM-DD","event":str},"ytdReturnPct":num${needPeers ? ',"peers":[...]' : ''}}`
  )
}

export async function buildDeepDive(symbol) {
  const sym = symbol.toUpperCase().trim()
  if (isDemo()) return demoDeepDive(sym)

  // quote + real statements in parallel
  const [quote, fund] = await Promise.all([
    getQuote(sym).catch(() => null),
    getFundamentals(sym),
  ])

  if (fund) {
    const report = { ...fund }
    if (quote) {
      report.price = quote.price
      report.change = quote.change ?? null
      report.changePct = quote.changePct ?? null
      report.sources = { ...report.sources, quote: { source: quote.source, time: quote.time } }
    }
    // one AI pass for what free APIs don't provide (hard 150s budget — the
    // real-data report ships even if enrichment is slow or fails)
    if (aiConfigured()) {
      try {
        const needPeers = !report.peers.length
        const text = await askClaudeWithSearch(
          gapSpec(sym, needPeers),
          { maxTokens: 2000, maxUses: 4, timeoutMs: 35000 }
        )
        const g = parseJSONLoose(text)
        if (g) {
          report.analysts = {
            ...report.analysts,
            targetLow: g.targetLow ?? report.analysts.targetLow,
            targetAvg: report.analysts.targetAvg ?? g.targetAvg ?? null,
            targetHigh: g.targetHigh ?? report.analysts.targetHigh,
            recent: Array.isArray(g.recent) ? g.recent : [],
          }
          if (!report.peers.length && Array.isArray(g.peers) && g.peers.length) {
            report.peers = g.peers.slice(0, 3)
          }
          report.screener = {
            ...report.screener,
            targetsTrend: g.targetsTrend ?? null,
            ytdReturnPct: g.ytdReturnPct ?? null,
            nextCatalyst: pickSoonerCatalyst(report.screener.nextCatalyst, g.nextCatalyst),
          }
          report.sources.analysts = { source: AI, time: new Date().toISOString() }
        }
      } catch { /* keep the real-data report even if AI enrichment fails */ }
    }
    report.dataMode = 'hybrid' // statements LIVE-API, analyst extras AI-SEARCH
    return report
  }

  // No real statements. If an Alpha Vantage key IS configured, `fund === null`
  // means the free tier throttled us (no-key is handled inside getFundamentals).
  // Return a fast, friendly 503 rather than a slow AI report that would 504 on
  // the 60s serverless limit — statements cache for a week once they land.
  if (process.env.ALPHAVANTAGE_API_KEY) {
    const e = new Error(`Alpha Vantage (free tier) is rate-limited right now. Give it ~60s and try ${sym} again — it then loads instantly for a week.`)
    e.status = 503
    throw e
  }
  // No AV key at all → AI-only path.
  if (!aiConfigured()) {
    const e = new Error('No data source available: set ALPHAVANTAGE_API_KEY and/or ANTHROPIC_API_KEY on the server.')
    e.status = 503
    throw e
  }
  if (!quote) {
    const e = new Error(`No data source recognizes "${sym}" right now — check the ticker.`)
    e.status = 404
    throw e
  }
  const text = await askClaudeWithSearch(
    `Build a complete equity research report for ${sym} using live data. Work fast — prefer fewer, broader searches. ${FULL_REPORT_SPEC}`,
    { maxTokens: 6000, maxUses: 5, timeoutMs: 50000 }
  )
  const r = parseJSONLoose(text)
  if (!r || !r.ticker) { const e = new Error(`Could not assemble a report for ${sym}. Try again.`); e.status = 502; throw e }
  if (quote) { r.price = quote.price; r.change = quote.change ?? r.change; r.changePct = quote.changePct ?? r.changePct }
  r.sources = { financials: { source: AI, time: new Date().toISOString() }, quote: quote ? { source: quote.source, time: quote.time } : undefined }
  r.dataMode = 'ai'
  return r
}

function pickSoonerCatalyst(a, b) {
  const valid = (c) => c && c.date && !isNaN(new Date(c.date)) && new Date(c.date) >= new Date(new Date().toDateString())
  if (!valid(a)) return valid(b) ? b : a || null
  if (!valid(b)) return a
  return new Date(a.date) <= new Date(b.date) ? a : b
}
