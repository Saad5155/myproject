import React, { useEffect, useState } from 'react'
import { testConnectivity } from '../lib/dataEngine'

function cls(v) {
  if (!v) return 'dim'
  if (v.includes('✓')) return 'ok'
  if (v.includes('NO KEY') || v.includes('LIMIT')) return 'warn'
  if (v.includes('ERR') || v.includes('BLOCK')) return 'err'
  return 'dim'
}

export default function StatusLine({ nonce }) {
  const [st, setSt] = useState({ finnhub: '…', alphavantage: '…', aisearch: '…' })

  useEffect(() => {
    let alive = true
    testConnectivity().then((s) => { if (alive) setSt(s) })
    return () => { alive = false }
  }, [nonce])

  return (
    <div className="statusline">
      <span>DATA ENGINE:</span>
      <span><span className="dim">FINNHUB</span> <span className={cls(st.finnhub)}>{st.finnhub}</span></span>
      <span><span className="dim">FMP</span> <span className={cls(st.fmp)}>{st.fmp}</span></span>
      <span><span className="dim">FRED</span> <span className={cls(st.fred)}>{st.fred}</span></span>
      <span><span className="dim">AI-SEARCH</span> <span className={cls(st.aisearch)}>{st.aisearch}</span></span>
    </div>
  )
}
