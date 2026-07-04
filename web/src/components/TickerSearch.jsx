'use client'
import React, { useState, useEffect, useRef } from 'react'

// Recent-search history, persisted in localStorage (shared across all search boxes).
const RECENT_KEY = 'tx_recent'
const RECENT_MAX = 8
function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function pushRecent(item) {
  try {
    const cur = loadRecent().filter((r) => r.symbol !== item.symbol)
    const next = [item, ...cur].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    return next
  } catch { return loadRecent() }
}

// Debounced ticker/company autocomplete. Calls onSelect(SYMBOL) on pick.
export default function TickerSearch({ onSelect, placeholder = 'Search company or ticker…', autoFocus, big }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState([])
  const boxRef = useRef(null)
  const timer = useRef(null)
  const seq = useRef(0)

  useEffect(() => { setRecent(loadRecent()) }, [])

  useEffect(() => {
    const query = q.trim()
    if (!query) { setResults([]); setLoading(false); return }
    setLoading(true)
    clearTimeout(timer.current)
    const mine = ++seq.current
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch('/api/search?q=' + encodeURIComponent(query))
        const j = r.ok ? await r.json() : []
        if (mine === seq.current) { setResults(Array.isArray(j) ? j : []); setOpen(true); setHi(0) }
      } catch {
        if (mine === seq.current) setResults([])
      } finally {
        if (mine === seq.current) setLoading(false)
      }
    }, 220)
    return () => clearTimeout(timer.current)
  }, [q])

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function choose(sym, description) {
    const s = String(sym).toUpperCase().trim()
    if (!s) return
    setRecent(pushRecent({ symbol: s, description: description || '' }))
    setQ(''); setResults([]); setOpen(false)
    onSelect(s)
  }

  // What the dropdown currently shows: live results when typing, else recents.
  const showRecent = !q.trim() && recent.length > 0
  const list = showRecent ? recent : results

  function onKey(e) {
    if (!open || !list.length) {
      if (e.key === 'Enter' && q.trim()) choose(q.trim())
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const p = list[hi]; choose(p?.symbol || q, p?.description) }
    else if (e.key === 'Escape') setOpen(false)
  }

  function clearRecent(e) {
    e.stopPropagation()
    try { localStorage.removeItem(RECENT_KEY) } catch { /* noop */ }
    setRecent([]); setOpen(false)
  }

  return (
    <div className={`tsearch ${big ? 'big' : ''}`} ref={boxRef}>
      <span className="tsearch-icon">⌕</span>
      <input
        className="tsearch-input" value={q} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
        onFocus={() => { setHi(0); setOpen(true) }}
        autoCapitalize="characters" autoComplete="off" spellCheck={false}
      />
      {q && <span className="tsearch-clear" onClick={() => { setQ(''); setResults([]) }}>✕</span>}
      {open && (list.length > 0 || loading) && (
        <div className="tsearch-drop">
          {showRecent && (
            <div className="tsearch-head">
              <span>RECENT</span>
              <span className="tsearch-clearrecent" onClick={clearRecent}>clear</span>
            </div>
          )}
          {loading && !results.length && !showRecent && <div className="tsearch-item dim">searching…</div>}
          {list.map((r, i) => (
            <div key={r.symbol + i} className={`tsearch-item ${i === hi ? 'hi' : ''}`}
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(r.symbol, r.description)}>
              <span className="green bold">{r.symbol}</span>
              <span className="dim tsearch-desc">{r.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
