'use client'
import React, { useEffect, useState, useRef } from 'react'
import { getMacro } from '../lib/dataEngine'
import { num, pct, classFor, timeShort } from '../lib/format'

function Item({ it }) {
  const arrow = it.changePct == null ? '' : it.changePct > 0 ? '▲' : it.changePct < 0 ? '▼' : '·'
  return (
    <span className="tape-item">
      <span className="dim">{it.label}</span>{' '}
      <span className="white">{it.price != null ? num(it.price) : '—'}</span>{' '}
      <span className={classFor(it.changePct)}>{arrow} {it.changePct != null ? pct(it.changePct) : ''}</span>
      {it.source && <span className={`src ${it.source === 'LIVE-API' ? 'live' : 'ai'}`}>{it.source === 'LIVE-API' ? 'LIVE' : 'AI'}</span>}
    </span>
  )
}

function econChips(econ) {
  if (!econ || !econ.available) return []
  const out = []
  if (econ.treasury10y) out.push({ label: 'US10Y', text: econ.treasury10y.value + '%' })
  if (econ.fedFunds) out.push({ label: 'FED FUNDS', text: econ.fedFunds.value + '%' })
  if (econ.unemployment) out.push({ label: 'UNEMP', text: econ.unemployment.value + '%' })
  if (econ.cpi) out.push({ label: 'CPI', text: num(econ.cpi.value, 1) })
  if (econ.wti) out.push({ label: 'WTI', text: '$' + num(econ.wti.value, 2) })
  return out
}

export default function MarketTape() {
  const [snap, setSnap] = useState(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)

  async function load() {
    setBusy(true)
    try { setSnap(await getMacro()) } finally { setBusy(false) }
  }

  useEffect(() => {
    load()
    timer.current = setInterval(load, 60000) // refresh every 60s
    return () => clearInterval(timer.current)
  }, [])

  const items = snap?.items || []
  const chips = econChips(snap?.econ)
  const seq = [...items.map((it, i) => <Item key={'a' + i} it={it} />),
  ...chips.map((c, i) => (
    <span className="tape-item" key={'e' + i}><span className="cyan">{c.label}</span> <span className="amber">{c.text}</span></span>
  ))]

  return (
    <div className="tape" aria-label="Live market tape">
      <button className="tape-refresh" onClick={load} title="refresh macro" aria-label="Refresh market data">
        {busy ? '···' : '↻'} <span className="dim">{snap?.time ? timeShort(snap.time) : ''}</span>
      </button>
      <div className="tape-viewport">
        {seq.length === 0 ? (
          <div className="tape-track" style={{ animation: 'none' }}><span className="tape-item dim">{busy ? 'LOADING MACRO TAPE…' : 'MACRO TAPE — set FINNHUB_API_KEY for live data'}</span></div>
        ) : (
          <div className="tape-track">
            {seq}{seq /* duplicate for seamless marquee */}
          </div>
        )}
      </div>
    </div>
  )
}
