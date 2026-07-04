'use client'
import React, { useEffect, useState } from 'react'
import { Modal, Spinner } from './common'
import TickerSearch from './TickerSearch'
import PriceChart, { IndexArea } from './PriceChart'
import { getMarkets } from '../lib/dataEngine'
import { num, pct, classFor } from '../lib/format'

// Colored badge per index, TradingView-style.
const IDX_BADGE = {
  SPY: { t: '500', c: '#e5484d' }, QQQ: { t: '100', c: '#2f6bff' },
  DIA: { t: '30', c: '#12b3c8' }, IWM: { t: '2K', c: '#a855f7' },
}
const badgeFor = (sym) => IDX_BADGE[sym] || { t: sym.slice(0, 3), c: '#2ba15f' }
const unitFor = (sym) => (sym === 'QQQ' ? 'POINT' : 'USD')

function MoverRow({ m, onPick, active }) {
  return (
    <tr className={`tickerrow ${active ? 'row-active' : ''}`} onClick={() => onPick(m.symbol)}>
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
  const [sel, setSel] = useState(null) // selected symbol → inline chart

  useEffect(() => { getMarkets().then(setData).catch(() => {}).finally(() => setBusy(false)) }, [])

  const chart = (sym) => setSel(sym.toUpperCase())       // tap anything → chart it here
  const openDeep = (sym) => { onSelect(sym); onClose() } // go to full deep dive
  const indices = (data?.items || []).filter((it) => it.group === 'index')
  const sectors = data?.sectors || []
  const movers = data?.movers || {}
  const econ = data?.econ
  const moverList = movers?.[tab] || []

  const chips = []
  if (econ?.available) {
    if (econ.treasury10y) chips.push(['US 10Y', econ.treasury10y.value + '%'])
    if (econ.fedFunds) chips.push(['FED', econ.fedFunds.value + '%'])
    if (econ.cpi) chips.push(['CPI', num(econ.cpi.value, 1) + '%'])
    if (econ.unemployment) chips.push(['UNEMP', econ.unemployment.value + '%'])
    if (econ.wti) chips.push(['WTI', '$' + num(econ.wti.value, 2)])
  }

  return (
    <Modal title="Markets · Overview" onClose={onClose}>
      <TickerSearch big autoFocus placeholder="Search any company or ticker → chart it"
        onSelect={chart} />
      <div className="dim" style={{ fontSize: 10, margin: '4px 2px 12px' }}>
        tap any ticker below to chart it here, then open its full financial deep dive
      </div>

      {/* SELECTED CHART */}
      {sel && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--amber-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="amber bold" style={{ fontSize: 15 }}>{sel}</span>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn amber" onClick={() => openDeep(sel)}>OPEN FULL DEEP DIVE →</button>
            <span className="close-x" style={{ cursor: 'pointer' }} onClick={() => setSel(null)}>✕</span>
          </div>
          <PriceChart symbol={sel} height={220} defaultRange="1Y" />
        </div>
      )}

      {busy && <div style={{ padding: '10px 0' }}><Spinner label="LOADING MARKETS" /></div>}

      {/* INDICES with sparklines */}
      {indices.length > 0 && (
        <>
          <div className="section-title">INDICES</div>
          <div className="idx-grid" style={{ marginBottom: 10 }}>
            {indices.map((it) => {
              const b = badgeFor(it.symbol)
              return (
                <div key={it.symbol} className={`idx-card ${sel === it.symbol ? 'row-active' : ''}`} onClick={() => chart(it.symbol)}>
                  <div className="idx-top">
                    <span className="idx-badge" style={{ background: b.c }}>{b.t}</span>
                    <span className="idx-name">{it.label}</span>
                  </div>
                  <div className="idx-price">{it.price != null ? num(it.price) : '—'} <span className="idx-unit">{unitFor(it.symbol)}</span></div>
                  <div className={`idx-chg ${classFor(it.changePct)}`}>{it.changePct != null ? pct(it.changePct) : '—'} <span className="dim">today</span></div>
                  <IndexArea symbol={it.symbol} up={(it.changePct ?? 0) >= 0} height={72} />
                </div>
              )
            })}
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
            <tbody>{moverList.map((m) => <MoverRow key={m.symbol} m={m} onPick={chart} active={sel === m.symbol} />)}</tbody>
          </table>
        </>
      )}

      {/* SECTORS */}
      {sectors.length > 0 && (
        <>
          <div className="section-title">SECTORS TODAY</div>
          {sectors.map((s) => (
            <div key={s.symbol} className={`tickerrow ${sel === s.symbol ? 'row-active' : ''}`} onClick={() => chart(s.symbol)}
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
          Search works now. Live movers/sectors/indices need your data keys
          (<span className="cyan">FINNHUB_API_KEY</span> / <span className="cyan">FMP_API_KEY</span>) on the server.
        </div>
      )}
    </Modal>
  )
}
