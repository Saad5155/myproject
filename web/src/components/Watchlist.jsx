'use client'
import React from 'react'
import { Panel, SourceBadge, Spinner } from './common'
import TickerSearch from './TickerSearch'
import { money, pct, classFor } from '../lib/format'

export default function Watchlist({ watchlist = [], setWatchlist, quotes, refreshQuotes, refreshing, openTicker, onAlert, className }) {
  function add(sym) {
    const s = sym.toUpperCase().trim()
    if (!s) return
    setWatchlist((w) => (w.includes(s) ? w : [...w, s]))
    refreshQuotes && refreshQuotes([s])
  }
  function remove(sym) { setWatchlist((w) => w.filter((x) => x !== sym)) }

  return (
    <Panel
      title="Watchlist" fk="F8" className={className}
      right={<button className="btn ghost" onClick={() => refreshQuotes && refreshQuotes(watchlist)} disabled={refreshing || !watchlist.length}>
        {refreshing ? <Spinner label="SYNC" /> : '↻ QUOTES'}
      </button>}
    >
      <div style={{ marginBottom: 8 }}>
        <TickerSearch placeholder="＋ add a company to watch…" onSelect={add} />
      </div>

      {watchlist.length === 0 ? (
        <div className="muted-box">Nothing on your watchlist yet. Search a company above to track its price — tap any row for the full deep dive.</div>
      ) : (
        <table className="tbl">
          <thead><tr><th>Sym</th><th>Last</th><th>Chg</th><th></th></tr></thead>
          <tbody>
            {watchlist.map((sym) => {
              const q = quotes[sym]
              const ok = q && !q.error
              return (
                <tr key={sym} className="tickerrow" onClick={() => openTicker && openTicker(sym)}>
                  <td className="green bold">{sym}{ok && <SourceBadge source={q.source} />}</td>
                  <td className="right">{ok ? money(q.price) : <span className="dim">—</span>}</td>
                  <td className={`right ${ok ? classFor(q.changePct) : 'dim'}`}>{ok ? pct(q.changePct) : '—'}</td>
                  <td className="right nowrap">
                    <span className="cyan" title="deep dive" style={{ cursor: 'pointer', marginRight: 8 }} onClick={(e) => { e.stopPropagation(); openTicker(sym) }}>◎</span>
                    <span className="red" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); remove(sym) }}>✕</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {watchlist.length > 0 && <div className="swipe-hint">tap a row → COMPANY DEEP DIVE</div>}
    </Panel>
  )
}
