'use client'
import React, { useEffect, useState } from 'react'
import { Modal } from './common'
import TickerSearch from './TickerSearch'
import { getMacro } from '../lib/dataEngine'
import { num, pct, classFor } from '../lib/format'

export default function SearchModal({ onClose, onSelect }) {
  const [macro, setMacro] = useState(null)

  useEffect(() => { getMacro().then(setMacro).catch(() => {}) }, [])

  const items = macro?.items || []
  const econ = macro?.econ
  const chips = []
  if (econ?.available) {
    if (econ.treasury10y) chips.push(['US 10Y', econ.treasury10y.value + '%'])
    if (econ.fedFunds) chips.push(['FED FUNDS', econ.fedFunds.value + '%'])
    if (econ.cpi) chips.push(['CPI', num(econ.cpi.value, 1)])
    if (econ.unemployment) chips.push(['UNEMP', econ.unemployment.value + '%'])
    if (econ.wti) chips.push(['WTI', '$' + num(econ.wti.value, 2)])
  }

  return (
    <Modal title="Search · Markets" onClose={onClose}>
      <TickerSearch big autoFocus placeholder="Search a company or ticker → deep dive"
        onSelect={(sym) => { onSelect(sym); onClose() }} />
      <div className="dim" style={{ fontSize: 10, margin: '4px 2px 12px' }}>
        type a name or symbol, ↑↓ to choose, Enter to open the full research report
      </div>

      <div className="section-title">MARKETS SNAPSHOT</div>
      {items.length === 0 ? (
        <div className="muted-box" style={{ fontSize: 12 }}>Loading live markets… (needs FINNHUB_API_KEY for live prices)</div>
      ) : (
        <div className="grid2" style={{ gap: '2px 16px' }}>
          {items.map((it) => (
            <div className="stat" key={it.symbol}>
              <span className="k">{it.label}</span>
              <span className="v">
                {it.price != null ? num(it.price) : '—'}{' '}
                <span className={classFor(it.changePct)} style={{ fontSize: 11 }}>
                  {it.changePct != null ? pct(it.changePct) : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {chips.length > 0 && (
        <>
          <div className="section-title">ECONOMY</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chips.map(([k, v]) => (
              <span className="tag" key={k}><span className="cyan">{k}</span> <span className="amber">{v}</span></span>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
