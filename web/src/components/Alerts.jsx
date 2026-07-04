import React, { useState } from 'react'
import { Panel } from './common'
import { money, stamp, uid } from '../lib/format'

// Evaluate alerts against a quotes map -> list of triggered alert objects (with price).
export function checkAlerts(alerts, quotes) {
  const triggered = []
  for (const a of alerts) {
    if (!a.active) continue
    const q = quotes[a.ticker]
    if (!q || q.error || q.price == null) continue
    const hit = a.condition === 'below' ? q.price <= a.price : q.price >= a.price
    if (hit) triggered.push({ ...a, currentPrice: q.price })
  }
  return triggered
}

// Full-screen flashing terminal warning shown before anything else.
export function AlertKlaxon({ triggered, onDismiss }) {
  if (!triggered.length) return null
  return (
    <div className="klaxon">
      <div className="warnbig">⚠ ALERTS TRIGGERED ⚠</div>
      {triggered.map((a) => (
        <div className="alert-row" key={a.id}>
          {a.ticker} {a.condition === 'below' ? 'BELOW' : 'ABOVE'} {money(a.price)} — NOW {money(a.currentPrice)}
        </div>
      ))}
      <button className="btn red big" style={{ maxWidth: 320 }} onClick={onDismiss}>ACKNOWLEDGE</button>
    </div>
  )
}

export default function Alerts({ alerts, setAlerts, lastCheck, className }) {
  const [form, setForm] = useState({ ticker: '', condition: 'below', price: '' })

  function add() {
    const t = form.ticker.toUpperCase().trim()
    const p = Number(form.price)
    if (!t || !(p > 0)) return
    setAlerts((a) => [...a, { id: uid(), ticker: t, condition: form.condition, price: p, active: true, triggeredAt: null }])
    setForm({ ticker: '', condition: 'below', price: '' })
  }
  function remove(id) { setAlerts((a) => a.filter((x) => x.id !== id)) }
  function toggle(id) { setAlerts((a) => a.map((x) => (x.id === id ? { ...x, active: !x.active } : x))) }

  return (
    <Panel title="Alerts" fk="F5" className={className} badge={lastCheck ? `checked ${stamp(lastCheck)}` : null}>
      <div className="btn-row" style={{ marginBottom: 8, flexWrap: 'nowrap' }}>
        <input style={{ width: 78 }} placeholder="TICKER" value={form.ticker}
          onChange={(e) => setForm({ ...form, ticker: e.target.value })} autoCapitalize="characters" spellCheck={false} />
        <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
          <option value="below">below</option>
          <option value="above">above</option>
        </select>
        <input style={{ width: 90 }} placeholder="PRICE" value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn" onClick={add}>SET</button>
      </div>

      {alerts.length === 0 ? (
        <div className="muted-box">No alerts. e.g. "LLY below 1150" or "JPM above 345". All alerts auto-check on every app open.</div>
      ) : (
        <table className="tbl">
          <thead><tr><th>Sym</th><th>Cond</th><th>Price</th><th>State</th><th></th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="green bold">{a.ticker}</td>
                <td className={a.condition === 'below' ? 'red' : 'green'}>{a.condition}</td>
                <td className="right">{money(a.price)}</td>
                <td>
                  <span className={a.active ? 'green' : 'dim'} style={{ cursor: 'pointer' }} onClick={() => toggle(a.id)}>
                    {a.active ? '● ARMED' : '○ OFF'}
                  </span>
                </td>
                <td><span className="red" style={{ cursor: 'pointer' }} onClick={() => remove(a.id)}>✕</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
