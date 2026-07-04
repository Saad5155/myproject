import React, { useState } from 'react'
import { Panel, Spinner, ErrBox } from './common'
import { daysUntil, stamp } from '../lib/format'
import { askClaudeWithSearch, parseJSONLoose, hasClaudeKey } from '../lib/claude'

const TYPE_COLOR = { earnings: 'green', fed: 'amber', cpi: 'cyan', macro: 'amber', other: 'dim' }

export default function Calendar({ tickers, calendar, setCalendar, className }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function populate() {
    if (!hasClaudeKey()) { setError('Set your Claude API key in SETTINGS.'); return }
    setBusy(true); setError(null)
    try {
      const holdings = tickers.length ? tickers.join(', ') : '(none)'
      const text = await askClaudeWithSearch(
        `Build a catalyst calendar. Find upcoming dated events for these holdings: ${holdings} ` +
        `(next earnings date for each), plus key macro dates: next FOMC/Fed meeting, next CPI release, ` +
        `next jobs report. Only future events. Return ONLY JSON: {"events":[{"date":"YYYY-MM-DD",` +
        `"event":string,"ticker":string|null,"type":"earnings"|"fed"|"cpi"|"macro"|"other"}]}. Sorted soonest first.`,
        { maxTokens: 2000, maxUses: 6 }
      )
      const parsed = parseJSONLoose(text)
      const events = parsed?.events || (Array.isArray(parsed) ? parsed : [])
      if (!events.length) throw new Error('No events returned.')
      setCalendar({ events, time: new Date().toISOString() })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const events = (calendar?.events || [])
    .map((e) => ({ ...e, days: daysUntil(e.date) }))
    .filter((e) => e.days != null && e.days >= 0)
    .sort((a, b) => a.days - b.days)

  return (
    <Panel
      title="Catalyst Calendar" fk="F6" className={className}
      badge={calendar?.time ? `updated ${stamp(calendar.time)}` : null}
      right={<button className="btn amber" onClick={populate} disabled={busy}>{busy ? <Spinner label="LOOKUP" /> : '↻ POPULATE'}</button>}
    >
      {error && <ErrBox>{error}</ErrBox>}
      {events.length === 0 && !busy && !error && (
        <div className="muted-box">Press POPULATE to auto-fill earnings dates for your holdings plus Fed / CPI / jobs dates.</div>
      )}
      {busy && events.length === 0 && (
        <div className="loading-seq">
          <div className="term-line active">[..] LOOKING UP EARNINGS DATES<span className="term-caret" /></div>
          <div className="term-line dim">[  ] FETCHING FED / CPI CALENDAR</div>
        </div>
      )}
      {events.map((e, i) => (
        <div className="cal-item" key={i}>
          <div className="cal-cd">
            <div className="num">{e.days}</div>
            <div className="unit">{e.days === 1 ? 'day' : 'days'}</div>
          </div>
          <div className="cal-body">
            <div className="ev">
              {e.ticker && <span className={`${TYPE_COLOR[e.type] || 'green'} bold`}>{e.ticker} </span>}
              {e.event}
            </div>
            <div className="dt">{e.date} · <span className={TYPE_COLOR[e.type] || 'dim'}>{(e.type || 'event').toUpperCase()}</span></div>
          </div>
        </div>
      ))}
    </Panel>
  )
}
