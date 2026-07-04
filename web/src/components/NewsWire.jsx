import React, { useState } from 'react'
import { Panel, Spinner, ErrBox } from './common'
import { stamp } from '../lib/format'
import { askClaudeWithSearch, parseJSONLoose, hasClaudeKey } from '../lib/claude'

function sentimentTag(s) {
  const v = (s || '').toLowerCase()
  if (v.startsWith('bull')) return <span className="tag bull">🟢 BULLISH</span>
  if (v.startsWith('bear')) return <span className="tag bear">🔴 BEARISH</span>
  return <span className="tag neutral">⚪ NEUTRAL</span>
}

export default function NewsWire({ tickers, news, setNews, className }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function refresh() {
    if (!hasClaudeKey()) { setError('Set your Claude API key in SETTINGS.'); return }
    setBusy(true); setError(null)
    try {
      const holdings = tickers.length ? tickers.join(', ') : '(no holdings yet — focus on broad market)'
      const prompt =
        `Pull the most important financial news RIGHT NOW for a retail investor whose holdings are: ${holdings}. ` +
        `Cover two buckets: (1) headlines specifically affecting those holdings, (2) macro/political news ` +
        `(Fed, elections, geopolitics, oil, rates). For EACH headline, tag AI sentiment for THIS portfolio and say why it matters. ` +
        `Return ONLY JSON, no prose: {"items":[{"headline":string,"source":string,"tickers":[string],` +
        `"sentiment":"bullish"|"bearish"|"neutral","why":string,"macro":boolean}]}. 8-12 items, most important first.`
      const text = await askClaudeWithSearch(prompt, { maxTokens: 3500, maxUses: 8 })
      const parsed = parseJSONLoose(text)
      const items = parsed?.items || (Array.isArray(parsed) ? parsed : [])
      if (!items.length) throw new Error('No headlines returned. Try again.')
      setNews({ items, time: new Date().toISOString() })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const items = news?.items || []

  return (
    <Panel
      title="News & Sentiment Wire" fk="F3" className={className}
      badge={news?.time ? `updated ${stamp(news.time)}` : null}
      right={<button className="btn amber" onClick={refresh} disabled={busy}>{busy ? <Spinner label="PULLING" /> : '↻ REFRESH WIRE'}</button>}
    >
      {error && <ErrBox>{error}</ErrBox>}
      {items.length === 0 && !busy && !error && (
        <div className="muted-box">Press REFRESH WIRE to pull live headlines affecting your holdings + macro, each AI-tagged for sentiment.</div>
      )}
      {busy && items.length === 0 && (
        <div className="loading-seq">
          <div className="term-line active">[..] SCANNING NEWSWIRES<span className="term-caret" /></div>
          <div className="term-line dim">[  ] MATCHING TO YOUR HOLDINGS</div>
          <div className="term-line dim">[  ] SCORING SENTIMENT</div>
        </div>
      )}
      <div className="wire">
        {items.map((it, i) => (
          <div className="wire-item" key={i}>
            <div className="meta">
              {sentimentTag(it.sentiment)}
              {it.macro && <span className="tag">MACRO</span>}
              {(it.tickers || []).map((t) => <span key={t} className="green">{t}</span>)}
              {it.source && <span className="dim">· {it.source}</span>}
            </div>
            <div className="head">{it.headline}</div>
            {it.why && <div className="why">▸ {it.why}</div>}
          </div>
        ))}
      </div>
    </Panel>
  )
}
