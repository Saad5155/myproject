'use client'
import React, { useEffect, useState } from 'react'
import { Modal, Spinner } from './common'
import TickerSearch from './TickerSearch'
import { getMarkets } from '../lib/dataEngine'
import { num, pct, classFor } from '../lib/format'

function MoverRow({ m, onSelect }) {
  return (
    <tr className="tickerrow" onClick={() => onSelect(m.symbol)}>
      <td className="green bold">{m.symbol}</td>
      <td className="right">{m.price != null ? num(m.price) : '—'}</td>
      <td className={`right ${classFor(m.changePct)}`}>{m.changePct != null ? pct(m.changePct) : '—'}</td>
    </tr>
  )
}

export default function MarketsModal({ onClose, onSelect }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [tab, setTab] = useState('gainers')

  useEffect(() => { getMarkets().then(setData).catch(() => {}).finally(() => setBusy(false)) }, [])

  const pick = (sym) => { onSelect(sym); onClose() }
  const indices = data?.items || []
  const sectors = data?.sectors || []
  const movers = data?.movers || {}
  const econ = data?.econ
  const moverList = movers?.[tab] || []

  const chips = []
  if (econ?.available) {
    if (econ.treasury10y) chips.push(['US 10Y', econ.treasury10y.value + '%'])
    if (econ.fedFunds) chips.push(['FED', econ.fedFunds.value + '%'])
    if (econ.cpi) chips.push(['CPI', num(econ.cpi.value, 1)])
    if (econ.unemployment) chips.push(['UNEMP', econ.unemployment.value + '%'])
    if (econ.wti) chips.push(['WTI', '$' + num(econ.wti.value, 2)])
  }

  return (
    <Modal title="Markets · Explore" onClose={onClose}>
      <TickerSearch big autoFocus placeholder="Search any company or ticker → deep dive"
        onSelect={pick} />
      <div className="dim" style={{ fontSize: 10, margin: '4px 2px 12px' }}>
        search, or tap anything below to open its full financial deep dive
      </div>

      {busy && <div style={{ padding: '10px 0' }}><Spinner label="LOADING MARKETS" /></div>}

      {/* INDICES */}
      {indices.length > 0 && (
        <>
          <div className="section-title">INDICES</div>
          <div className="grid2" style={{ gap: '2px 16px', marginBottom: 4 }}>
            {indices.filter((it) => it.group === 'index').map((it) => (
              <div className="stat" key={it.symbol}>
                <span className="k">{it.label}</span>
                <span className="v">{it.price != null ? num(it.price) : '—'} <span className={classFor(it.changePct)} style={{ fontSize: 11 }}>{it.changePct != null ? pct(it.changePct) : ''}</span></span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MOVERS */}
      {movers?.available && (
        <>
          <div className="section-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>MOVERS</span>
            <span className="spacer" style={{ flex: 1 }} />
            {[['gainers', 'GAINERS'], ['losers', 'LOSERS'], ['active', 'ACTIVE']].map(([k, lbl]) => (
              <span key={k} onClick={() => setTab(k)} style={{ cursor: 'pointer', fontSize: 11, padding: '1px 7px', border: '1px solid var(--grid-line)', color: tab === k ? 'var(--amber)' : 'var(--text-dim)', background: tab === k ? '#1a1200' : 'transparent' }}>{lbl}</span>
            ))}
          </div>
          <table className="tbl">
            <thead><tr><th>Sym</th><th>Price</th><th>Chg</th></tr></thead>
            <tbody>{moverList.map((m) => <MoverRow key={m.symbol} m={m} onSelect={pick} />)}</tbody>
          </table>
        </>
      )}

      {/* SECTORS */}
      {sectors.length > 0 && (
        <>
          <div className="section-title">SECTORS TODAY</div>
          {sectors.map((s) => (
            <div key={s.symbol} className="tickerrow" onClick={() => pick(s.symbol)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 2px', cursor: 'pointer' }}>
              <span style={{ width: 96, flex: '0 0 auto' }} className="dim">{s.label}</span>
              <div className="allocbar" style={{ flex: 1 }}>
                <i style={{ width: `${Math.min(100, Math.abs(s.changePct || 0) * 20)}%`, background: (s.changePct || 0) >= 0 ? 'linear-gradient(90deg,var(--green-dim),var(--green))' : 'linear-gradient(90deg,var(--red-dim),var(--red))' }} />
              </div>
              <span className={`${classFor(s.changePct)}`} style={{ width: 56, textAlign: 'right', flex: '0 0 auto' }}>{s.changePct != null ? pct(s.changePct) : '—'}</span>
            </div>
          ))}
        </>
      )}

      {/* ECONOMY */}
      {chips.length > 0 && (
        <>
          <div className="section-title">ECONOMY</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chips.map(([k, v]) => <span className="tag" key={k}><span className="cyan">{k}</span> <span className="amber">{v}</span></span>)}
          </div>
        </>
      )}

      {!busy && indices.length === 0 && !movers?.available && sectors.length === 0 && (
        <div className="muted-box" style={{ fontSize: 12 }}>
          Search works now. Live movers/sectors/indices need your <span className="cyan">FINNHUB_API_KEY</span> + <span className="cyan">ALPHAVANTAGE_API_KEY</span> on the server.
        </div>
      )}
    </Modal>
  )
}
