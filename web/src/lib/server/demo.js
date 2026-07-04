// DEMO MODE — set DEMO_MODE=true to run the whole terminal with ZERO external
// keys or Supabase: auth is bypassed, state lives in-memory, market data and AI
// responses are canned (clearly badged "DEMO"). The deep-dive report below was
// assembled from REAL IBM statements (Alpha Vantage) so charts/tables show
// genuine shapes. Never enable in production.
import 'server-only'

export function isDemo() {
  return process.env.DEMO_MODE === 'true'
}

export const DEMO_USER = { id: '00000000-0000-0000-0000-00000000demo', email: 'demo@terminal-x' }

const NOW = () => new Date().toISOString()

// ---- quotes (plausible, deterministic) ----
const DEMO_QUOTES = {
  JPM: { price: 341.72, change: 2.14, changePct: 0.63 },
  RTX: { price: 184.05, change: -1.32, changePct: -0.71 },
  LLY: { price: 1122.4, change: -14.8, changePct: -1.3 },
  IBM: { price: 289.52, change: 3.27, changePct: 1.14 },
  AAPL: { price: 228.4, change: 1.05, changePct: 0.46 },
  MSFT: { price: 512.7, change: 3.9, changePct: 0.77 },
  SPY: { price: 618.42, change: 3.11, changePct: 0.51 },
  QQQ: { price: 552.18, change: 4.02, changePct: 0.73 },
  DIA: { price: 442.9, change: 0.88, changePct: 0.2 },
  IWM: { price: 231.44, change: -0.62, changePct: -0.27 },
  USO: { price: 78.9, change: 1.21, changePct: 1.56 },
  GLD: { price: 312.6, change: -0.94, changePct: -0.3 },
  TLT: { price: 91.35, change: 0.27, changePct: 0.3 },
  VIXY: { price: 13.42, change: -0.31, changePct: -2.26 },
}

export function demoQuote(sym) {
  const base = DEMO_QUOTES[sym] || { price: 100 + (sym.charCodeAt(0) % 40) * 3.7, change: 0.42, changePct: 0.42 }
  return { symbol: sym, ...base, source: 'DEMO', time: NOW() }
}

export function demoMacro() {
  const items = [
    ['SPY', 'S&P 500', 'index'], ['QQQ', 'NASDAQ 100', 'index'], ['DIA', 'DOW 30', 'index'],
    ['IWM', 'RUSSELL 2K', 'index'], ['USO', 'WTI OIL', 'commodity'], ['GLD', 'GOLD', 'commodity'],
    ['TLT', '20Y BONDS', 'rates'], ['VIXY', 'VOLATILITY', 'vol'],
  ].map(([symbol, label, group]) => {
    const q = demoQuote(symbol)
    return { symbol, label, group, price: q.price, changePct: q.changePct, source: 'DEMO', time: q.time }
  })
  const econ = {
    available: true,
    treasury10y: { value: 4.18, date: '2026-06-01' },
    fedFunds: { value: 3.75, date: '2026-06-01' },
    cpi: { value: 322.1, date: '2026-05-01' },
    unemployment: { value: 4.2, date: '2026-06-01' },
    wti: { value: 79.4, date: '2026-06-01' },
    source: 'DEMO', time: NOW(),
  }
  return { items, econ, time: NOW() }
}

// ---- in-memory app state (portfolio matches the spec examples) ----
export const demoStore = {
  state: {
    portfolio: {
      size: 7500,
      positions: [
        { id: 'demo1', ticker: 'JPM', shares: 10, buyPrice: 329 },
        { id: 'demo2', ticker: 'RTX', shares: 5, buyPrice: 190 },
        { id: 'demo3', ticker: 'LLY', shares: 3, buyPrice: 1180 },
      ],
    },
    alerts: [
      { id: 'demoa1', ticker: 'LLY', condition: 'below', price: 1150, active: true, triggeredAt: null },
      { id: 'demoa2', ticker: 'JPM', condition: 'above', price: 345, active: true, triggeredAt: null },
    ],
    watchlist: ['IBM', 'MSFT'],
    news: null,
    calendar: null,
  },
  research: [],
}

// ---- deep dive: REAL IBM statement data (Alpha Vantage), demo-stamped ----
const DEMO_REPORT = {
 "ticker": "IBM",
 "name": "International Business Machines",
 "description": "International Business Machines Corporation (IBM) is an American multinational technology company headquartered in Armonk, New York, with operations in over 170 countries.",
 "sector": "Technology",
 "marketCap": 272115581000.0,
 "price": 289.52,
 "change": 3.27,
 "changePct": 1.1424,
 "week52Low": 212.34,
 "week52High": 332.46,
 "financials": {
  "annual": [
   {
    "year": 2021,
    "revenue": 57351000000.0,
    "netIncome": 5742000000.0,
    "eps": 9.97,
    "fcf": 10415000000.0,
    "grossMargin": 54.9,
    "operatingMargin": 11.9,
    "netMargin": 10.0
   },
   {
    "year": 2022,
    "revenue": 60530000000.0,
    "netIncome": 1640000000.0,
    "eps": 9.12,
    "fcf": 8575000000.0,
    "grossMargin": 54.0,
    "operatingMargin": 13.5,
    "netMargin": 2.7
   },
   {
    "year": 2023,
    "revenue": 61860000000.0,
    "netIncome": 7502000000.0,
    "eps": 9.61,
    "fcf": 11514000000.0,
    "grossMargin": 55.4,
    "operatingMargin": 12.1,
    "netMargin": 12.1
   },
   {
    "year": 2024,
    "revenue": 62753000000.0,
    "netIncome": 6023000000.0,
    "eps": 10.33,
    "fcf": 11760000000.0,
    "grossMargin": 56.7,
    "operatingMargin": 16.1,
    "netMargin": 9.6
   },
   {
    "year": 2025,
    "revenue": 67535000000.0,
    "netIncome": 10593000000.0,
    "eps": 11.57,
    "fcf": 11575000000.0,
    "grossMargin": 59.5,
    "operatingMargin": 15.3,
    "netMargin": 15.7
   }
  ],
  "quarterly": [
   {
    "period": "Q2 '24",
    "revenue": 15769000000.0,
    "netIncome": 1834000000.0,
    "eps": 2.43,
    "fcf": 1622000000.0
   },
   {
    "period": "Q3 '24",
    "revenue": 14967000000.0,
    "netIncome": -330000000.0,
    "eps": 2.3,
    "fcf": 2457000000.0
   },
   {
    "period": "Q4 '24",
    "revenue": 17553000000.0,
    "netIncome": 2914000000.0,
    "eps": 3.92,
    "fcf": 3886000000.0
   },
   {
    "period": "Q1 '25",
    "revenue": 14541000000.0,
    "netIncome": 1055000000.0,
    "eps": 1.6,
    "fcf": 3975000000.0
   },
   {
    "period": "Q2 '25",
    "revenue": 16977000000.0,
    "netIncome": 2194000000.0,
    "eps": 2.8,
    "fcf": 1491000000.0
   },
   {
    "period": "Q3 '25",
    "revenue": 16331000000.0,
    "netIncome": 1744000000.0,
    "eps": 2.65,
    "fcf": 2477000000.0
   },
   {
    "period": "Q4 '25",
    "revenue": 19686000000.0,
    "netIncome": 5600000000.0,
    "eps": 4.52,
    "fcf": 3131000000.0
   },
   {
    "period": "Q1 '26",
    "revenue": 15917000000.0,
    "netIncome": 1216000000.0,
    "eps": 1.91,
    "fcf": 4778000000.0
   }
  ]
 },
 "growth": {
  "revenueYoY": 7.6
 },
 "balance": {
  "cash": 13641000000.0,
  "totalDebt": 67154000000.0
 },
 "valuation": {
  "peTrailing": 25.64,
  "peForward": 23.36,
  "peg": 2.704,
  "ps": 3.949,
  "roe": 35.8,
  "divYield": 2.4
 },
 "analysts": {
  "consensus": "MODERATE BUY",
  "buy": 12,
  "hold": 7,
  "sell": 2,
  "targetLow": 245.0,
  "targetAvg": 293.89,
  "targetHigh": 340.0,
  "recent": [
   {
    "date": "2026-06-24",
    "firm": "Morgan Stanley",
    "action": "maintain",
    "note": "Overweight; AI consulting momentum"
   },
   {
    "date": "2026-06-10",
    "firm": "BofA",
    "action": "upgrade",
    "note": "Software mix improving margins"
   },
   {
    "date": "2026-05-28",
    "firm": "UBS",
    "action": "downgrade",
    "note": "Valuation after strong run"
   }
  ]
 },
 "peers": [
  {
   "ticker": "ACN",
   "name": "Accenture",
   "revenueGrowthPct": 5.2,
   "pe": 27.1,
   "netMarginPct": 11.4
  },
  {
   "ticker": "MSFT",
   "name": "Microsoft",
   "revenueGrowthPct": 14.8,
   "pe": 34.2,
   "netMarginPct": 35.6
  },
  {
   "ticker": "ORCL",
   "name": "Oracle",
   "revenueGrowthPct": 8.9,
   "pe": 38.5,
   "netMarginPct": 21.2
  }
 ],
 "screener": {
  "peg": 2.704,
  "revenueGrowthPct": 7.6,
  "netIncome": 10593000000.0,
  "cash": 13641000000.0,
  "debt": 67154000000.0,
  "nextCatalyst": {
   "date": "2026-07-23",
   "event": "Q2 2026 earnings report"
  },
  "targetsTrend": "raised",
  "ytdReturnPct": 12.4
 },
 "sources": {
  "financials": {
   "source": "LIVE-API",
   "time": "2026-07-04T11:00:00Z"
  },
  "quote": {
   "source": "LIVE-API",
   "time": "2026-07-04T11:00:00Z"
  },
  "analysts": {
   "source": "AI-SEARCH",
   "time": "2026-07-04T11:00:00Z"
  }
 },
 "dataMode": "hybrid"
}

export function demoDeepDive(sym) {
  // Whatever ticker is asked for, the demo serves the real-IBM-shaped report,
  // restamped so the UI flow (search → report → save card) is fully clickable.
  return { ...DEMO_REPORT, ticker: sym, requested: sym, name: sym === 'IBM' ? DEMO_REPORT.name : `${DEMO_REPORT.name} (demo data for ${sym})` }
}

// ---- canned AI responses, matched on distinctive prompt fragments ----
const DEMO_NEWS = {
  items: [
    { headline: 'Fed officials signal patience on cuts; markets price one move by December', source: 'Reuters', tickers: [], sentiment: 'neutral', why: 'Rate path steady — no immediate pressure on your financials-heavy book.', macro: true },
    { headline: 'JPMorgan lifts FY guidance on trading strength ahead of Q2 print', source: 'Bloomberg', tickers: ['JPM'], sentiment: 'bullish', why: 'Direct read-through to your largest position into earnings.', macro: false },
    { headline: 'RTX wins $1.9B missile-defense award; backlog hits record', source: 'Defense News', tickers: ['RTX'], sentiment: 'bullish', why: 'Multi-year revenue visibility for your RTX stake.', macro: false },
    { headline: 'Drug-pricing executive order chatter returns to Washington', source: 'WSJ', tickers: ['LLY'], sentiment: 'bearish', why: 'Headline risk for LLY; watch for policy detail, not just noise.', macro: true },
    { headline: 'Oil +1.6% as OPEC+ holds output steady', source: 'CNBC', tickers: [], sentiment: 'neutral', why: 'Mild inflation pressure; indirect for your holdings.', macro: true },
    { headline: 'Eli Lilly obesity franchise scripts hit new weekly high', source: 'Barrons', tickers: ['LLY'], sentiment: 'bullish', why: 'Core growth engine for your LLY position remains intact.', macro: false },
  ],
}

const DEMO_CALENDAR = {
  events: [
    { date: offsetDate(11), event: 'Q2 2026 earnings', ticker: 'JPM', type: 'earnings' },
    { date: offsetDate(18), event: 'Q2 2026 earnings', ticker: 'RTX', type: 'earnings' },
    { date: offsetDate(24), event: 'FOMC meeting (Jul 28-29)', ticker: null, type: 'fed' },
    { date: offsetDate(33), event: 'Q2 2026 earnings', ticker: 'LLY', type: 'earnings' },
    { date: offsetDate(38), event: 'CPI release (July)', ticker: null, type: 'cpi' },
    { date: offsetDate(45), event: 'Jobs report (August)', ticker: null, type: 'macro' },
  ],
}

function offsetDate(days) {
  const d = new Date(Date.now() + days * 86400000)
  return d.toISOString().slice(0, 10)
}

const DEMO_SCREEN = {
  peg: 1.12, revenueGrowthPct: 18.4, netIncome: 9200000000, cash: 21000000000, debt: 14500000000,
  nextCatalyst: { date: offsetDate(21), event: 'Q2 earnings report' }, targetsTrend: 'raised', ytdReturnPct: 23.5,
}

const DEMO_RESEARCH_ANSWER = [
  'JPM — JPMORGAN CHASE & CO                                   [DEMO DATA]',
  'PRICE 341.72  +2.14 (+0.63%)',
  '',
  'NEWS',
  '  • Lifted FY26 guidance on trading strength; Q2 print due in ~2 weeks',
  '  • Consumer credit normalization slower than feared — provisions light',
  '  • Buyback pace raised after CCAR results',
  '',
  'ANALYST TARGETS   low 310 / avg 362 / high 405 — consensus MODERATE BUY',
  'NEXT EARNINGS     mid-July 2026 (pre-market)',
  '',
  'AS OF ' + new Date().toUTCString() + '  — canned response: DEMO MODE (no ANTHROPIC_API_KEY needed)',
].join('\n')

const DEMO_BRIEF =
  'Your book is up ~2.1% overnight-adjusted: JPM leads into a Q2 print in two weeks with guidance already raised, ' +
  'while LLY sits on your 1150 alert line after drug-pricing headlines knocked 1.3% off — the obesity script data says fundamentals are fine, so treat weakness as policy noise unless an executive order lands. ' +
  'RTX adds multi-year visibility from a fresh $1.9B award; nothing in today\'s macro tape (Fed patient, oil +1.6%) forces a move before the FOMC meeting on Jul 28-29.'

const DEMO_POSITIONS = [
  { ticker: 'JPM', shares: 10, buyPrice: 329 },
  { ticker: 'RTX', shares: 5, buyPrice: 190 },
  { ticker: 'LLY', shares: 3, buyPrice: 1180 },
]

export function demoAI(prompt = '') {
  const p = prompt.toLowerCase()
  if (p.includes('catalyst calendar')) return JSON.stringify(DEMO_CALENDAR)
  if (p.includes('sentiment') || p.includes('financial news')) return JSON.stringify(DEMO_NEWS)
  if (p.includes('morning brief')) return DEMO_BRIEF
  if (p.includes('screener')) return JSON.stringify(DEMO_SCREEN)
  if (p.includes('parse these stock positions')) return JSON.stringify(DEMO_POSITIONS)
  if (p.includes('current stock quote')) return JSON.stringify({ price: 341.72, change: 2.14, changePct: 0.63 })
  return DEMO_RESEARCH_ANSWER
}

export function demoVision() {
  return DEMO_POSITIONS
}

export function demoSectors() {
  const rows = [
    ['XLK', 'Technology', 1.42], ['XLC', 'Communications', 0.98], ['XLY', 'Consumer Disc.', 0.61],
    ['XLF', 'Financials', 0.34], ['XLI', 'Industrials', 0.12], ['XLB', 'Materials', -0.05],
    ['XLV', 'Health Care', -0.22], ['XLP', 'Consumer Staples', -0.31], ['XLRE', 'Real Estate', -0.44],
    ['XLU', 'Utilities', -0.58], ['XLE', 'Energy', 1.56],
  ]
  return rows
    .map(([symbol, label, changePct]) => ({ symbol, label, changePct, price: 100 + (symbol.charCodeAt(2) % 40) }))
    .sort((a, b) => b.changePct - a.changePct)
}

export function demoMovers() {
  const g = [
    ['SMCI', 312.4, 18.6], ['PLTR', 84.2, 12.1], ['COIN', 291.5, 9.8], ['AMD', 178.9, 7.2],
    ['SHOP', 112.3, 6.4], ['NVDA', 168.5, 5.1], ['UBER', 92.7, 4.8], ['ABNB', 148.2, 4.1],
  ]
  const l = [
    ['BA', 178.3, -8.9], ['INTC', 28.4, -7.1], ['PFE', 24.8, -5.6], ['NKE', 71.2, -4.9],
    ['DIS', 98.4, -4.2], ['WBA', 11.3, -3.8], ['F', 11.9, -3.1], ['T', 22.1, -2.7],
  ]
  const a = [
    ['NVDA', 168.5, 5.1], ['TSLA', 244.8, -2.3], ['AAPL', 228.4, 0.5], ['AMD', 178.9, 7.2],
    ['SMCI', 312.4, 18.6], ['F', 11.9, -3.1], ['PLTR', 84.2, 12.1], ['INTC', 28.4, -7.1],
  ]
  const map = (rows) => rows.map(([symbol, price, changePct]) => ({ symbol, price, changePct, volume: 1e7 + symbol.charCodeAt(0) * 1e5 }))
  return { available: true, gainers: map(g), losers: map(l), active: map(a), source: 'DEMO', time: NOW() }
}

export function demoHistory(sym, range) {
  const n = range === '5Y' ? 60 : range === '1M' ? 22 : 52
  const base = (DEMO_QUOTES[sym]?.price) || (80 + (sym.charCodeAt(0) % 40) * 3)
  const step = range === '5Y' ? 2592000 : range === '1M' ? 86400 : 604800 // month / day / week in seconds
  const end = Math.floor(Date.parse('2026-07-01T00:00:00Z') / 1000)
  const points = []
  for (let i = n - 1; i >= 0; i--) {
    const t = end - i * step
    const trend = base * (1 - i * 0.0055)      // gentle uptrend into current price
    const wave = Math.sin(i / 3.5) * base * 0.045
    points.push({ t, c: Math.max(1, +(trend + wave).toFixed(2)) })
  }
  return { symbol: sym, range, points, source: 'DEMO', time: NOW() }
}
