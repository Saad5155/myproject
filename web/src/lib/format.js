// Formatting helpers — currency, big numbers, percentages, timestamps.

export function money(n, dp = 2) {
  if (n == null || isNaN(n)) return '—'
  const neg = n < 0
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return (neg ? '-$' : '$') + s
}

export function num(n, dp = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function pct(n, dp = 2) {
  if (n == null || isNaN(n)) return '—'
  const v = Number(n)
  return (v > 0 ? '+' : '') + v.toFixed(dp) + '%'
}

export function signMoney(n, dp = 2) {
  if (n == null || isNaN(n)) return '—'
  return (n > 0 ? '+' : n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

// Compact big numbers: 1.2B, 340M, 12.4K
export function compact(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(2) + 'K'
  return sign + abs.toFixed(2)
}

export function moneyCompact(n) {
  const c = compact(n)
  return c === '—' ? '—' : '$' + c
}

export function classFor(n) {
  if (n == null || isNaN(n)) return 'dim'
  return n > 0 ? 'up' : n < 0 ? 'down' : 'dim'
}

export function nowISO() {
  return new Date().toISOString()
}

// HH:MM:SS local, for the on-demand "as of" label
export function timeShort(iso) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleTimeString('en-US', { hour12: false })
}

export function dateShort(iso) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}

export function stamp(iso) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

// Whole days until a future date string (YYYY-MM-DD or ISO). Negative if past.
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (isNaN(target)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
