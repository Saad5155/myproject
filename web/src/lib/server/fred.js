// FRED (Federal Reserve Economic Data) — free, official U.S. economic series.
// Primary source for the ECONOMY tape; Alpha Vantage kept as fallback.
import 'server-only'

const FRED = 'https://api.stlouisfed.org/fred/series/observations'
export const LIVE = 'LIVE-API'

export function fredConfigured() { return !!process.env.FRED_API_KEY }

const num = (v) => {
  if (v == null || v === '' || v === '.') return null
  const x = Number(v)
  return isNaN(x) ? null : x
}

// Latest valid observation for a series (FRED marks missing points as ".").
async function latest(seriesId, limit = 1) {
  try {
    const url = `${FRED}?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`
    const r = await fetch(url)
    if (!r.ok) return null
    const j = await r.json()
    const obs = (j?.observations || []).filter((o) => num(o.value) != null)
    return obs.length ? obs : null
  } catch { return null }
}

async function latestOne(seriesId) {
  const obs = await latest(seriesId, 1)
  const o = obs?.[0]
  return o ? { value: num(o.value), date: o.date } : null
}

// CPI as YoY inflation % (raw index is meaningless as a chip) — needs 13 months.
async function cpiYoY() {
  const obs = await latest('CPIAUCSL', 14)
  if (!obs || obs.length < 13) {
    const one = obs?.[0]
    return one ? { value: num(one.value), date: one.date } : null
  }
  const cur = num(obs[0].value)
  const yearAgo = num(obs[12].value)
  if (cur == null || !yearAgo) return null
  return { value: Math.round(((cur / yearAgo) - 1) * 1000) / 10, date: obs[0].date }
}

// Returns the same econ shape providers.getEcon produces.
export async function getFredEcon() {
  if (!fredConfigured()) return null
  const [treasury10y, fedFunds, cpi, unemployment, wti] = await Promise.all([
    latestOne('DGS10'),       // 10Y treasury constant maturity, %
    latestOne('FEDFUNDS'),    // effective federal funds rate, %
    cpiYoY(),                 // CPI inflation YoY, %
    latestOne('UNRATE'),      // unemployment rate, %
    latestOne('DCOILWTICO'),  // WTI crude, $/bbl
  ])
  const vals = { fedFunds, cpi, treasury10y, unemployment, wti }
  if (!Object.values(vals).some(Boolean)) return null
  return { available: true, ...vals, source: LIVE, time: new Date().toISOString() }
}
