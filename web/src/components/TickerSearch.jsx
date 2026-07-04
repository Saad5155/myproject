'use client'
import React, { useState, useEffect, useRef } from 'react'

// Debounced ticker/company autocomplete. Calls onSelect(SYMBOL) on pick.
export default function TickerSearch({ onSelect, placeholder = 'Search company or ticker…', autoFocus, big }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)
  const timer = useRef(null)
  const seq = useRef(0)

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

  function choose(sym) {
    const s = String(sym).toUpperCase().trim()
    if (!s) return
    setQ(''); setResults([]); setOpen(false)
    onSelect(s)
  }

  function onKey(e) {
    if (!open || !results.length) {
      if (e.key === 'Enter' && q.trim()) choose(q.trim())
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[hi]?.symbol || q) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className={`tsearch ${big ? 'big' : ''}`} ref={boxRef}>
      <span className="tsearch-icon">⌕</span>
      <input
        className="tsearch-input" value={q} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
        onFocus={() => results.length && setOpen(true)}
        autoCapitalize="characters" autoComplete="off" spellCheck={false}
      />
      {q && <span className="tsearch-clear" onClick={() => { setQ(''); setResults([]) }}>✕</span>}
      {open && (results.length > 0 || loading) && (
        <div className="tsearch-drop">
          {loading && !results.length && <div className="tsearch-item dim">searching…</div>}
          {results.map((r, i) => (
            <div key={r.symbol + i} className={`tsearch-item ${i === hi ? 'hi' : ''}`}
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(r.symbol)}>
              <span className="green bold">{r.symbol}</span>
              <span className="dim tsearch-desc">{r.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
