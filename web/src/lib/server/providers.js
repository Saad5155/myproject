// Server-side market-data engine with automatic fallback + Supabase quote cache.
//   1) Finnhub  2) Alpha Vantage  3) Claude + web_search
// Cache TTLs: quotes 60s, fundamentals 24h — keeps us inside free-tier limits.
import 'server-only'
import { createServiceSupabase } from '../supabase/server'
import { askClaudeWithSearch, parseJSONLoose } from './anthropic'
import { isDemo, demoQuote, demoMacro } from './demo'

const FINNHUB = 'https://finnhub.io/api/v1'
const ALPHA = 'https://www.alphavantage.co/query'
export const LIVE = 'LIVE-API'
export const AI = 'AI-SEARCH'

const QUOTE_TTL_MS = 60 * 1000
const FUND_TTL_MS = 24 * 60 * 60 * 1000

function now() { return new Date().toISOString() }

// ---- cache helpers (shared quote_cache table, service-role access) ----
async function cacheGet(symbol, kind, ttlMs) {
  try {
    const sb = createServiceSupabase()
    const { data } = await sb.from('quote_cache').select('data, updated_at').eq('symbol', symbol).eq('kind', kind).maybeSingle()
    if (data && data.updated_at && Date.now() - new Date(data.updated_at).getTime() < ttlMs) return data.data
  } catch { /* cache miss on error */ }
  return null
}
async function cacheSet(symbol, kind, data) {
  try {
    const sb = createServiceSupabase()
    await sb.from('quote_cache').upsert({ symbol, kind, data, updated_at: now() }, { onConflict: 'symbol,kind' })
  } catch { /* ignore cache write errors */ }
}

// ---- connectivity ----
export async function testConnectivity() {
  if (isDemo()) return { finnhub: 'DEMO MODE', alphavantage: 'DEMO MODE', aisearch: 'DEMO MODE' }
  const out = {
    finnhub: process.env.FINNHUB_API_KEY ? 'CHECKING…' : 'NO KEY',
    alphavantage: process.env.ALPHAVANTAGE_API_KEY ? 'CHECKING…' : 'NO KEY',
    aisearch: process.env.ANTHROPIC_API_KEY ? 'READY ✓' : 'NO KEY',
  }
  const checks = []
  if (process.env.FINNHUB_API_KEY) {
    checks.push(fetch(`${FINNHUB}/quote?symbol=AAPL&token=${process.env.FINNHUB_API_KEY}`)
      .then((r) => r.json())
      .then((j) => { out.finnhub = (j && typeof j.c === 'number' && j.c > 0) ? 'CONNECTED ✓' : 'ERROR' })
      .catch(() => { out.finnhub = 'BLOCKED' }))
  }
  if (process.env.ALPHAVANTAGE_API_KEY) {
    checks.push(fetch(`${ALPHA}?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${process.env.ALPHAVANTAGE_API_KEY}`)
      .then((r) => r.json())
      .then((j) => {
        if (j && j['Global Quote'] && Object.keys(j['Global Quote']).length) out.alphavantage = 'CONNECTED ✓'
        else if (j && (j.Note || j.Information)) out.alphavantage = 'RATE LIMIT'
        else out.alphavantage = 'ERROR'
      })
      .catch(() => { out.alphavantage = 'BLOCKED' }))
  }
  await Promise.all(checks)
  return out
}

// ---- single quote (Finnhub → Alpha Vantage → AI web-search) ----
export async function getQuote(symbol) {
  const sym = symbol.toUpperCase().trim()
  if (isDemo()) return demoQuote(sym)
  const cached = await cacheGet(sym, 'quote', QUOTE_TTL_MS)
  if (cached) return { ...cached, cached: true }

  if (process.env.FINNHUB_API_KEY) {
    try {
      const r = await fetch(`${FINNHUB}/quote?symbol=${sym}&token=${process.env.FINNHUB_API_KEY}`)
      if (r.ok) {
        const j = await r.json()
        if (j && typeof j.c === 'number' && j.c > 0) {
          const q = { symbol: sym, price: j.c, change: j.d, changePct: j.dp, prevClose: j.pc, high: j.h, low: j.l, source: LIVE, time: now() }
          await cacheSet(sym, 'quote', q)
          return q
        }
      }
    } catch { /* fall through */ }
  }
  if (process.env.ALPHAVANTAGE_API_KEY) {
    try {
      const r = await fetch(`${ALPHA}?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${process.env.ALPHAVANTAGE_API_KEY}`)
      if (r.ok) {
        const j = await r.json()
        const g = j && j['Global Quote']
        const price = g && Number(g['05. price'])
        if (price > 0) {
          const q = {
            symbol: sym, price,
            change: Number(g['09. change']) || 0,
            changePct: Number(String(g['10. change percent'] || '').replace('%', '')) || 0,
            prevClose: Number(g['08. previous close']) || null,
            source: LIVE, time: now(),
          }
          await cacheSet(sym, 'quote', q)
          return q
        }
      }
    } catch { /* fall through */ }
  }
  const text = await askClaudeWithSearch(
    `Current stock quote for ${sym}. Reply ONLY with JSON, no prose: {"price":number,"change":number,"changePct":number}. Use the most recent price you can find.`,
    { maxTokens: 800, maxUses: 3 }
  )
  const j = parseJSONLoose(text)
  if (j && typeof j.price === 'number') {
    const q = { symbol: sym, price: j.price, change: j.change ?? 0, changePct: j.changePct ?? 0, source: AI, time: now() }
    await cacheSet(sym, 'quote', q)
    return q
  }
  throw new Error(`Could not fetch a quote for ${sym}`)
}

export async function getQuotes(symbols) {
  const uniq = [...new Set(symbols.map((s) => String(s).toUpperCase().trim()).filter(Boolean))]
  const entries = await Promise.all(uniq.map(async (sym) => {
    try { return [sym, await getQuote(sym)] } catch (e) { return [sym, { symbol: sym, error: e.message }] }
  }))
  return Object.fromEntries(entries)
}

// ---- profile ----
export async function getProfile(symbol) {
  const sym = symbol.toUpperCase().trim()
  const cached = await cacheGet(sym, 'profile', FUND_TTL_MS)
  if (cached) return { ...cached, cached: true }
  if (process.env.FINNHUB_API_KEY) {
    try {
      const r = await fetch(`${FINNHUB}/stock/profile2?symbol=${sym}&token=${process.env.FINNHUB_API_KEY}`)
      if (r.ok) {
        const j = await r.json()
        if (j && j.name) {
          const p = { symbol: sym, name: j.name, sector: j.finnhubIndustry, marketCap: j.marketCapitalization ? j.marketCapitalization * 1e6 : null, source: LIVE, time: now() }
          await cacheSet(sym, 'profile', p)
          return p
        }
      }
    } catch { /* fall through */ }
  }
  const text = await askClaudeWithSearch(
    `Company profile for ticker ${sym}. Reply ONLY JSON: {"name":string,"sector":string,"marketCap":number}. marketCap in USD.`,
    { maxTokens: 600, maxUses: 2 }
  )
  const j = parseJSONLoose(text)
  const p = { symbol: sym, name: j?.name || sym, sector: j?.sector || null, marketCap: j?.marketCap ?? null, source: AI, time: now() }
  await cacheSet(sym, 'profile', p)
  return p
}

// ---- REAL financial statements via Alpha Vantage ----
// One deep dive = 6 AV calls (OVERVIEW, INCOME_STATEMENT, BALANCE_SHEET,
// CASH_FLOW, EARNINGS, EARNINGS_CALENDAR), cached 24h per symbol.
// AV free tier is 25 calls/day → ~4 fresh tickers/day; cache covers repeats.

const num = (v) => {
  if (v == null || v === '' || v === 'None' || v === '-') return null
  const x = Number(v)
  return isNaN(x) ? null : x
}
const pctFrac = (v) => { const x = num(v); return x == null ? null : Math.round(x * 1000) / 10 } // 0.358 → 35.8
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10)

async function avFetch(fn, sym, extra = '') {
  try {
    const r = await fetch(`${ALPHA}?function=${fn}&symbol=${sym}${extra}&apikey=${process.env.ALPHAVANTAGE_API_KEY}`)
    if (!r.ok) return null
    const j = await r.json()
    if (!j || j.Note || j.Information || j['Error Message']) return null
    return j
  } catch { return null }
}

// EARNINGS_CALENDAR returns CSV: symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay
async function avNextEarnings(sym) {
  try {
    const r = await fetch(`${ALPHA}?function=EARNINGS_CALENDAR&symbol=${sym}&horizon=3month&apikey=${process.env.ALPHAVANTAGE_API_KEY}`)
    if (!r.ok) return null
    const text = await r.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2 || !lines[0].toLowerCase().startsWith('symbol')) return null
    const cols = lines[1].split(',')
    return cols[2] && /^\d{4}-\d{2}-\d{2}$/.test(cols[2]) ? cols[2] : null
  } catch { return null }
}

async function finnhubPeers(sym) {
  if (!process.env.FINNHUB_API_KEY) return null
  try {
    const r = await fetch(`${FINNHUB}/stock/peers?symbol=${sym}&token=${process.env.FINNHUB_API_KEY}`)
    if (!r.ok) return null
    const j = await r.json()
    if (Array.isArray(j)) return j.filter((p) => p && p !== sym).slice(0, 3)
  } catch { /* noop */ }
  return null
}

// Assemble a deep-dive report skeleton from REAL statements. Returns null when
// AV is unavailable (no key / rate limit) so the caller can fall back to AI.
export async function getFundamentals(symbol) {
  const sym = symbol.toUpperCase().trim()
  if (!process.env.ALPHAVANTAGE_API_KEY) return null
  const cached = await cacheGet(sym, 'fundamentals', FUND_TTL_MS)
  if (cached) return { ...cached, cached: true }

  const [ov, inc, bs, cf, earn, nextEarnings, peers] = await Promise.all([
    avFetch('OVERVIEW', sym),
    avFetch('INCOME_STATEMENT', sym),
    avFetch('BALANCE_SHEET', sym),
    avFetch('CASH_FLOW', sym),
    avFetch('EARNINGS', sym),
    avNextEarnings(sym),
    finnhubPeers(sym),
  ])
  if (!ov?.Symbol || !inc?.annualReports?.length) return null // rate-limited or unknown symbol

  const year = (d) => (d || '').slice(0, 4)
  const epsByYear = {}
  for (const e of earn?.annualEarnings || []) epsByYear[year(e.fiscalDateEnding)] = num(e.reportedEPS)
  const epsByQuarter = {}
  for (const e of earn?.quarterlyEarnings || []) epsByQuarter[e.fiscalDateEnding] = num(e.reportedEPS)
  const fcfByYear = {}
  for (const c of cf?.annualReports || []) {
    const op = num(c.operatingCashflow), capex = num(c.capitalExpenditures)
    fcfByYear[year(c.fiscalDateEnding)] = op == null ? null : op - (capex ?? 0)
  }
  const fcfByQuarter = {}
  for (const c of cf?.quarterlyReports || []) {
    const op = num(c.operatingCashflow), capex = num(c.capitalExpenditures)
    fcfByQuarter[c.fiscalDateEnding] = op == null ? null : op - (capex ?? 0)
  }

  const annual = (inc.annualReports || []).slice(0, 5).reverse().map((a) => {
    const rev = num(a.totalRevenue), ni = num(a.netIncome)
    const gp = num(a.grossProfit), oi = num(a.operatingIncome)
    const y = year(a.fiscalDateEnding)
    return {
      year: Number(y), revenue: rev, netIncome: ni,
      eps: epsByYear[y] ?? null, fcf: fcfByYear[y] ?? null,
      grossMargin: rev && gp != null ? round1((gp / rev) * 100) : null,
      operatingMargin: rev && oi != null ? round1((oi / rev) * 100) : null,
      netMargin: rev && ni != null ? round1((ni / rev) * 100) : null,
    }
  })

  const quarterly = (inc.quarterlyReports || []).slice(0, 8).reverse().map((q) => {
    const d = q.fiscalDateEnding || ''
    const qn = Math.ceil(Number(d.slice(5, 7)) / 3)
    return {
      period: `Q${qn} '${d.slice(2, 4)}`,
      revenue: num(q.totalRevenue), netIncome: num(q.netIncome),
      eps: epsByQuarter[d] ?? null, fcf: fcfByQuarter[d] ?? null,
    }
  })

  const b0 = bs?.annualReports?.[0] || {}
  const cash = num(b0.cashAndShortTermInvestments) ?? num(b0.cashAndCashEquivalentsAtCarryingValue)
  const totalDebt = num(b0.shortLongTermDebtTotal) ?? ((num(b0.shortTermDebt) ?? 0) + (num(b0.longTermDebt) ?? 0) || null)

  const last = annual[annual.length - 1], prev = annual[annual.length - 2]
  const revenueYoY = last?.revenue && prev?.revenue ? round1(((last.revenue / prev.revenue) - 1) * 100) : pctFrac(ov.QuarterlyRevenueGrowthYOY)

  const buy = (num(ov.AnalystRatingStrongBuy) ?? 0) + (num(ov.AnalystRatingBuy) ?? 0)
  const hold = num(ov.AnalystRatingHold) ?? 0
  const sell = (num(ov.AnalystRatingSell) ?? 0) + (num(ov.AnalystRatingStrongSell) ?? 0)
  const consensus = buy > (hold + sell) ? 'BUY' : sell > (buy + hold) ? 'SELL' : buy > sell ? 'MODERATE BUY' : 'HOLD'

  const description = String(ov.Description || '').split(/(?<=\.)\s+/).slice(0, 2).join(' ')

  const report = {
    ticker: sym,
    name: ov.Name || sym,
    description,
    sector: ov.Sector || ov.Industry || null,
    marketCap: num(ov.MarketCapitalization),
    price: null, change: null, changePct: null, // quote merged in by the deep-dive builder
    week52Low: num(ov['52WeekLow']),
    week52High: num(ov['52WeekHigh']),
    financials: { annual, quarterly },
    growth: { revenueYoY },
    balance: { cash, totalDebt },
    valuation: {
      peTrailing: num(ov.TrailingPE) ?? num(ov.PERatio),
      peForward: num(ov.ForwardPE),
      peg: num(ov.PEGRatio),
      ps: num(ov.PriceToSalesRatioTTM),
      roe: pctFrac(ov.ReturnOnEquityTTM),
      divYield: pctFrac(ov.DividendYield),
    },
    analysts: {
      consensus, buy, hold, sell,
      targetLow: null, targetAvg: num(ov.AnalystTargetPrice), targetHigh: null,
      recent: [],
    },
    peers: (peers || []).map((p) => ({ ticker: p, name: null, revenueGrowthPct: null, pe: null, netMarginPct: null })),
    screener: {
      peg: num(ov.PEGRatio),
      revenueGrowthPct: revenueYoY,
      netIncome: last?.netIncome ?? null,
      cash, debt: totalDebt,
      nextCatalyst: nextEarnings ? { date: nextEarnings, event: 'Earnings report' } : null,
      targetsTrend: null, // AI-filled
      ytdReturnPct: null, // AI-filled
    },
    sources: { financials: { source: LIVE, time: now() } },
  }
  await cacheSet(sym, 'fundamentals', report)
  return report
}

// ---- MACRO snapshot (real-time via provider proxies + economic indicators) ----
const MACRO_BASKET = [
  { symbol: 'SPY', label: 'S&P 500', group: 'index' },
  { symbol: 'QQQ', label: 'NASDAQ 100', group: 'index' },
  { symbol: 'DIA', label: 'DOW 30', group: 'index' },
  { symbol: 'IWM', label: 'RUSSELL 2K', group: 'index' },
  { symbol: 'USO', label: 'WTI OIL', group: 'commodity' },
  { symbol: 'GLD', label: 'GOLD', group: 'commodity' },
  { symbol: 'TLT', label: '20Y BONDS', group: 'rates' },
  { symbol: 'VIXY', label: 'VOLATILITY', group: 'vol' },
]

async function getEcon() {
  const cached = await cacheGet('__ECON__', 'econ', FUND_TTL_MS)
  if (cached) return { ...cached, cached: true }
  if (!process.env.ALPHAVANTAGE_API_KEY) return { available: false }
  const key = process.env.ALPHAVANTAGE_API_KEY
  const latest = async (fn, extra = '') => {
    try {
      const r = await fetch(`${ALPHA}?function=${fn}${extra}&apikey=${key}`)
      const j = await r.json()
      const d = j?.data?.[0]
      return d ? { value: Number(d.value), date: d.date } : null
    } catch { return null }
  }
  const [fedFunds, cpi, treasury10y, unemployment, wti] = await Promise.all([
    latest('FEDERAL_FUNDS_RATE', '&interval=monthly'),
    latest('CPI', '&interval=monthly'),
    latest('TREASURY_YIELD', '&interval=monthly&maturity=10year'),
    latest('UNEMPLOYMENT'),
    latest('WTI', '&interval=monthly'),
  ])
  const econ = { available: true, fedFunds, cpi, treasury10y, unemployment, wti, source: LIVE, time: now() }
  await cacheSet('__ECON__', 'econ', econ)
  return econ
}

export async function getMarketSnapshot() {
  if (isDemo()) return demoMacro()
  const quotes = await getQuotes(MACRO_BASKET.map((b) => b.symbol))
  const items = MACRO_BASKET.map((b) => {
    const q = quotes[b.symbol]
    const ok = q && !q.error
    return { symbol: b.symbol, label: b.label, group: b.group, price: ok ? q.price : null, changePct: ok ? q.changePct : null, source: ok ? q.source : null, time: q?.time || null }
  })
  const econ = await getEcon()
  return { items, econ, time: now() }
}
