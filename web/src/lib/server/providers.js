// Server-side market-data engine with automatic fallback + Supabase quote cache.
//   1) Finnhub  2) Alpha Vantage  3) Claude + web_search
// Cache TTLs: quotes 60s, fundamentals 24h — keeps us inside free-tier limits.
import 'server-only'
import { createServiceSupabase } from '../supabase/server'
import { askClaudeWithSearch, parseJSONLoose } from './anthropic'

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

// ---- single quote ----
export async function getQuote(symbol) {
  const sym = symbol.toUpperCase().trim()
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
  const quotes = await getQuotes(MACRO_BASKET.map((b) => b.symbol))
  const items = MACRO_BASKET.map((b) => {
    const q = quotes[b.symbol]
    const ok = q && !q.error
    return { symbol: b.symbol, label: b.label, group: b.group, price: ok ? q.price : null, changePct: ok ? q.changePct : null, source: ok ? q.source : null, time: q?.time || null }
  })
  const econ = await getEcon()
  return { items, econ, time: now() }
}
