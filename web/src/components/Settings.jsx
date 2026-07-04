'use client'
import React, { useEffect, useState } from 'react'
import { Modal } from './common'
import { testConnectivity } from '../lib/dataEngine'

function cls(v) {
  if (!v) return 'dim'
  if (v.includes('✓')) return 'green'
  if (v.includes('NO KEY') || v.includes('LIMIT')) return 'amber'
  if (v.includes('ERR') || v.includes('BLOCK')) return 'red'
  return 'dim'
}

export default function Settings({ onClose, size, onSize }) {
  const [st, setSt] = useState({ finnhub: '…', fmp: '…', alphavantage: '…', fred: '…', aisearch: '…' })
  const [val, setVal] = useState(size)

  useEffect(() => { testConnectivity().then(setSt) }, [])

  function save() {
    const n = Number(val)
    if (!isNaN(n) && n >= 0) onSize(n)
    onClose()
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="section-title">DATA ENGINE STATUS</div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="stat"><span className="k">FINNHUB (quotes)</span><span className={`v ${cls(st.finnhub)}`}>{st.finnhub}</span></div>
        <div className="stat"><span className="k">FMP (fundamentals · movers)</span><span className={`v ${cls(st.fmp)}`}>{st.fmp}</span></div>
        <div className="stat"><span className="k">FRED (economy)</span><span className={`v ${cls(st.fred)}`}>{st.fred}</span></div>
        <div className="stat"><span className="k">ALPHA VANTAGE (fallback)</span><span className={`v ${cls(st.alphavantage)}`}>{st.alphavantage}</span></div>
        <div className="stat"><span className="k">AI-SEARCH (Claude)</span><span className={`v ${cls(st.aisearch)}`}>{st.aisearch}</span></div>
      </div>

      <div className="field">
        <label>Portfolio size (cash pool $)</label>
        <input value={val} onChange={(e) => setVal(e.target.value)} />
      </div>

      <div className="btn-row" style={{ marginTop: 6 }}>
        <button className="btn amber big" onClick={save}>SAVE</button>
      </div>

      <div className="muted-box" style={{ marginTop: 12, fontSize: 11 }}>
        API keys & the Claude model are configured server-side in <span className="cyan">.env</span> (never in the browser):{' '}
        <span className="dim">ANTHROPIC_API_KEY, CLAUDE_MODEL, FINNHUB_API_KEY, FMP_API_KEY, FRED_API_KEY, ALPHAVANTAGE_API_KEY.</span>{' '}
        A red/NO-KEY status above means that variable isn&apos;t set on the server.
      </div>
    </Modal>
  )
}
