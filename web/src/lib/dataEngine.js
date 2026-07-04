'use client'
// Client data wrappers — hit our API routes; the server does the caching + fallback.

export const LIVE = 'LIVE-API'
export const AI = 'AI-SEARCH'

export async function getQuotes(symbols) {
  const list = [...new Set(symbols.map((s) => String(s).toUpperCase().trim()).filter(Boolean))]
  if (!list.length) return {}
  try {
    const res = await fetch('/api/quotes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbols: list }) })
    if (!res.ok) throw new Error('quote fetch failed')
    return res.json()
  } catch {
    return Object.fromEntries(list.map((s) => [s, { symbol: s, error: 'fetch failed' }]))
  }
}

export async function getMarkets() {
  try {
    const res = await fetch('/api/markets')
    if (!res.ok) throw new Error('markets fetch failed')
    return res.json()
  } catch {
    return { items: [], econ: { available: false }, sectors: [], movers: { available: false }, error: true }
  }
}

export async function getMacro() {
  try {
    const res = await fetch('/api/macro')
    if (!res.ok) throw new Error('macro fetch failed')
    return res.json()
  } catch {
    return { items: [], econ: { available: false }, time: new Date().toISOString(), error: true }
  }
}

export async function getTelegramStatus() {
  try {
    const res = await fetch('/api/notify/test')
    if (!res.ok) throw new Error('status failed')
    return res.json()
  } catch {
    return { botConfigured: false, linked: false }
  }
}

export async function testTelegram() {
  try {
    const res = await fetch('/api/notify/test', { method: 'POST' })
    return res.json()
  } catch {
    return { ok: false, error: 'request failed' }
  }
}

export async function testConnectivity() {
  try {
    const res = await fetch('/api/connectivity')
    if (!res.ok) throw new Error('status failed')
    return res.json()
  } catch {
    return { finnhub: 'BLOCKED', alphavantage: 'BLOCKED', aisearch: 'ERROR' }
  }
}
