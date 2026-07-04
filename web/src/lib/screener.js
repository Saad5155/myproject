// The user's hard-coded 7 screening rules + evaluation against a metrics object.
// Metrics may come from live APIs or AI research; each rule returns pass/fail/unknown.

export const SCREENER_RULES = [
  { key: 'peg', label: 'PEG under 1.5' },
  { key: 'revGrowth', label: 'Revenue growth 15%+' },
  { key: 'profitable', label: 'Profitable (positive net income)' },
  { key: 'cashVsDebt', label: 'More cash than debt' },
  { key: 'catalyst', label: 'Catalyst within 1–3 months' },
  { key: 'targetsRaised', label: 'Analyst targets being RAISED' },
  { key: 'notRun', label: 'Has NOT already run 100%+ this year' },
]

const PASS = 'pass'
const FAIL = 'fail'
const UNK = 'unknown'

// m = normalized metrics: { peg, revenueGrowthPct, netIncome, cash, debt,
//   nextCatalyst: {date, event}, targetsTrend: 'raised'|'lowered'|'flat', ytdReturnPct }
export function evaluateScreener(m = {}) {
  const results = {}

  results.peg = triState(m.peg != null, () => m.peg > 0 && m.peg < 1.5,
    m.peg != null ? `PEG = ${fmt(m.peg)}` : 'PEG unavailable')

  results.revGrowth = triState(m.revenueGrowthPct != null, () => m.revenueGrowthPct >= 15,
    m.revenueGrowthPct != null ? `Rev growth = ${fmt(m.revenueGrowthPct)}%` : 'growth unavailable')

  results.profitable = triState(m.netIncome != null, () => m.netIncome > 0,
    m.netIncome != null ? `Net income ${m.netIncome > 0 ? 'positive' : 'negative'}` : 'net income unavailable')

  results.cashVsDebt = triState(m.cash != null && m.debt != null, () => m.cash > m.debt,
    (m.cash != null && m.debt != null) ? `cash vs debt ${abbr(m.cash)} / ${abbr(m.debt)}` : 'balance sheet unavailable')

  const hasCat = !!(m.nextCatalyst && m.nextCatalyst.date)
  const catDays = hasCat ? daysBetween(m.nextCatalyst.date) : null
  results.catalyst = triState(hasCat, () => catDays != null && catDays >= 0 && catDays <= 100,
    hasCat ? `${m.nextCatalyst.event || 'catalyst'} — ${m.nextCatalyst.date}` : 'no catalyst found')

  results.targetsRaised = triState(!!m.targetsTrend, () => m.targetsTrend === 'raised',
    m.targetsTrend ? `targets ${m.targetsTrend}` : 'target trend unavailable')

  results.notRun = triState(m.ytdReturnPct != null, () => m.ytdReturnPct < 100,
    m.ytdReturnPct != null ? `YTD ${fmt(m.ytdReturnPct)}%` : 'YTD return unavailable')

  const list = SCREENER_RULES.map((r) => ({ ...r, ...results[r.key] }))
  const passed = list.filter((r) => r.status === PASS).length
  const failed = list.filter((r) => r.status === FAIL).length
  const verdict = failed === 0 && passed >= 5 ? 'PASS' : passed >= 4 ? 'PARTIAL' : 'FAIL'
  return { list, passed, failed, total: SCREENER_RULES.length, verdict }
}

function triState(known, testFn, detail) {
  if (!known) return { status: UNK, detail }
  return { status: testFn() ? PASS : FAIL, detail }
}

function daysBetween(dateStr) {
  const t = new Date(dateStr)
  if (isNaN(t)) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0)
  return Math.round((t - now) / 86400000)
}

function fmt(n) { return n == null || isNaN(n) ? '—' : Number(n).toFixed(2) }
function abbr(n) {
  if (n == null || isNaN(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  return String(n)
}

export const SCREENER_PROMPT_SPEC =
  'Evaluate these fields as JSON (use null when unknown): ' +
  '{"peg": number, "revenueGrowthPct": number, "netIncome": number, "cash": number, "debt": number, ' +
  '"nextCatalyst": {"date": "YYYY-MM-DD", "event": string}, ' +
  '"targetsTrend": "raised"|"lowered"|"flat", "ytdReturnPct": number}'
