// Financial Modeling Prep (FMP) — free tier 250 calls/day (~10× Alpha Vantage).
// Used as the PRIMARY source for real financial statements + market movers,
// with Alpha Vantage / AI kept as fallbacks in providers.js.
import 'server-only'

const FMP = 'https://financialmodelingprep.com/api/v3'
const FMP4 = 'https://financialmodelingprep.com/api/v4'
export const LIVE = 'LIVE-API'

const num = (v) => {
  if (v == null || v === '' || v === 'None' || v === '-') return null
  const x = Number(v)
  return isNaN(x) ? null : x
}
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10)

function key() { return process.env.FMP_API_KEY }
export function fmpConfigured() { return !!process.env.FMP_API_KEY }

async function fmpGet(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) return null
    const j = await r.json()
    // FMP signals errors as an object with "Error Message" instead of an array
    if (!j || j['Error Message'] || j.error) return null
    return j
  } catch { return null }
}

// ---- quote (fast, one call) ----
export async function getFmpQuote(sym) {
  if (!fmpConfigured()) return null
  const j = await fmpGet(`${FMP}/quote/${encodeURIComponent(sym)}?apikey=${key()}`)
  const q = Array.isArray(j) ? j[0] : null
  if (!q || num(q.price) == null) return null
  return {
    symbol: sym,
    price: num(q.price),
    change: num(q.change) ?? 0,
    changePct: num(q.changesPercentage) ?? 0,
    prevClose: num(q.previousClose),
    high: num(q.dayHigh),
    low: num(q.dayLow),
    source: LIVE,
  }
}

// ---- market movers ----
export async function getFmpMovers() {
  if (!fmpConfigured()) return null
  const [g, l, a] = await Promise.all([
    fmpGet(`${FMP}/stock_market/gainers?apikey=${key()}`),
    fmpGet(`${FMP}/stock_market/losers?apikey=${key()}`),
    fmpGet(`${FMP}/stock_market/actives?apikey=${key()}`),
  ])
  const map = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 12).map((x) => ({
    symbol: x.symbol,
    price: num(x.price),
    changePct: num(x.changesPercentage),
  }))
  const gainers = map(g), losers = map(l), active = map(a)
  if (!gainers.length && !losers.length && !active.length) return null
  return { available: true, gainers, losers, active, source: LIVE }
}

// ---- full fundamentals report (same shape getFundamentals returns) ----
// Uses ~7 FMP calls: profile, income (annual+quarter), balance, cash-flow,
// ratios-ttm, price-target-consensus, analyst-recommendations. Cached 7d upstream.
export async function getFmpFundamentals(sym) {
  if (!fmpConfigured()) return null
  const k = key()
  const [profileArr, incA, incQ, bs, cfA, cfQ, ratios, ptc, recs, peersRes] = await Promise.all([
    fmpGet(`${FMP}/profile/${sym}?apikey=${k}`),
    fmpGet(`${FMP}/income-statement/${sym}?period=annual&limit=5&apikey=${k}`),
    fmpGet(`${FMP}/income-statement/${sym}?period=quarter&limit=8&apikey=${k}`),
    fmpGet(`${FMP}/balance-sheet-statement/${sym}?period=annual&limit=1&apikey=${k}`),
    fmpGet(`${FMP}/cash-flow-statement/${sym}?period=annual&limit=5&apikey=${k}`),
    fmpGet(`${FMP}/cash-flow-statement/${sym}?period=quarter&limit=8&apikey=${k}`),
    fmpGet(`${FMP}/ratios-ttm/${sym}?apikey=${k}`),
    fmpGet(`${FMP4}/price-target-consensus?symbol=${sym}&apikey=${k}`),
    fmpGet(`${FMP}/analyst-stock-recommendations/${sym}?apikey=${k}`),
    fmpGet(`${FMP4}/stock_peers?symbol=${sym}&apikey=${k}`),
  ])
  const profile = Array.isArray(profileArr) ? profileArr[0] : null
  if (!profile || !Array.isArray(incA) || !incA.length) return null

  const yr = (d) => Number((d || '').slice(0, 4))
  // FMP income rows: revenue, netIncome, eps, grossProfit, operatingIncome
  // FMP cash-flow rows: freeCashFlow (given directly), date
  const fcfByYear = {}
  for (const c of (Array.isArray(cfA) ? cfA : [])) fcfByYear[yr(c.date)] = num(c.freeCashFlow)
  const fcfByDate = {}
  for (const c of (Array.isArray(cfQ) ? cfQ : [])) fcfByDate[c.date] = num(c.freeCashFlow)

  const annual = [...(Array.isArray(incA) ? incA : [])].slice(0, 5).reverse().map((a) => {
    const rev = num(a.revenue), ni = num(a.netIncome)
    const gp = num(a.grossProfit), oi = num(a.operatingIncome)
    const y = yr(a.date)
    return {
      year: y, revenue: rev, netIncome: ni,
      eps: num(a.epsdiluted) ?? num(a.eps), fcf: fcfByYear[y] ?? null,
      grossMargin: rev && gp != null ? round1((gp / rev) * 100) : null,
      operatingMargin: rev && oi != null ? round1((oi / rev) * 100) : null,
      netMargin: rev && ni != null ? round1((ni / rev) * 100) : null,
    }
  })

  const quarterly = [...(Array.isArray(incQ) ? incQ : [])].slice(0, 8).reverse().map((q) => {
    const d = q.date || ''
    const qn = Math.ceil(Number(d.slice(5, 7)) / 3)
    return {
      period: `Q${qn} '${d.slice(2, 4)}`,
      revenue: num(q.revenue), netIncome: num(q.netIncome),
      eps: num(q.epsdiluted) ?? num(q.eps), fcf: fcfByDate[d] ?? null,
    }
  })

  const b0 = (Array.isArray(bs) ? bs[0] : null) || {}
  const cash = num(b0.cashAndShortTermInvestments) ?? num(b0.cashAndCashEquivalents)
  const totalDebt = num(b0.totalDebt) ?? ((num(b0.shortTermDebt) ?? 0) + (num(b0.longTermDebt) ?? 0) || null)

  const last = annual[annual.length - 1], prev = annual[annual.length - 2]
  const revenueYoY = last?.revenue && prev?.revenue ? round1(((last.revenue / prev.revenue) - 1) * 100) : null

  const rt = (Array.isArray(ratios) ? ratios[0] : null) || {}
  const pctFromFrac = (v) => { const x = num(v); return x == null ? null : Math.round(x * 1000) / 10 }

  // analyst recommendations: FMP returns newest-first monthly rollups
  const rec0 = (Array.isArray(recs) ? recs[0] : null) || {}
  const buy = (num(rec0.analystRatingsStrongBuy) ?? 0) + (num(rec0.analystRatingsbuy) ?? 0)
  const hold = num(rec0.analystRatingsHold) ?? 0
  const sell = (num(rec0.analystRatingsSell) ?? 0) + (num(rec0.analystRatingsStrongSell) ?? 0)
  const consensus = buy > (hold + sell) ? 'BUY' : sell > (buy + hold) ? 'SELL' : buy > sell ? 'MODERATE BUY' : 'HOLD'

  const pt = (Array.isArray(ptc) ? ptc[0] : null) || {}

  // 52-week range: FMP profile "range" is "low-high"
  let week52Low = null, week52High = null
  if (typeof profile.range === 'string' && profile.range.includes('-')) {
    const [lo, hi] = profile.range.split('-').map((s) => num(s.trim()))
    week52Low = lo; week52High = hi
  }

  const peersList = (Array.isArray(peersRes) ? peersRes[0]?.peersList : null) || []
  const peers = peersList.slice(0, 3).map((p) => ({ ticker: p, name: null, revenueGrowthPct: null, pe: null, netMarginPct: null }))

  const description = String(profile.description || '').split(/(?<=\.)\s+/).slice(0, 2).join(' ')

  return {
    ticker: sym,
    name: profile.companyName || sym,
    description,
    sector: profile.sector || profile.industry || null,
    marketCap: num(profile.mktCap),
    price: null, change: null, changePct: null, // merged by deep-dive builder
    week52Low, week52High,
    financials: { annual, quarterly },
    growth: { revenueYoY },
    balance: { cash, totalDebt },
    valuation: {
      peTrailing: round1(num(rt.peRatioTTM)) ?? round1(num(profile.pe)),
      peForward: null,
      peg: round1(num(rt.pegRatioTTM)),
      ps: round1(num(rt.priceToSalesRatioTTM)),
      roe: pctFromFrac(rt.returnOnEquityTTM),
      divYield: pctFromFrac(rt.dividendYieldTTM),
    },
    analysts: {
      consensus, buy, hold, sell,
      targetLow: num(pt.targetLow), targetAvg: num(pt.targetConsensus) ?? num(pt.targetMedian), targetHigh: num(pt.targetHigh),
      recent: [],
    },
    peers,
    screener: {
      peg: round1(num(rt.pegRatioTTM)),
      revenueGrowthPct: revenueYoY,
      netIncome: last?.netIncome ?? null,
      cash, debt: totalDebt,
      nextCatalyst: null, // AI/AV-filled downstream
      targetsTrend: null,
      ytdReturnPct: null,
    },
    sources: { financials: { source: LIVE, time: new Date().toISOString() } },
  }
}
