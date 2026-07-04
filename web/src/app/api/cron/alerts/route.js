import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase/server'
import { getQuotes } from '@/lib/server/providers'
import { sendTelegram, formatAlertHit, telegramConfigured } from '@/lib/server/telegram'

export const maxDuration = 60

// Scheduled alert sweep. Triggered by Vercel Cron (which sends
// `Authorization: Bearer $CRON_SECRET`) or any external pinger
// (cron-job.org) via ?secret=... for intraday frequency.
//
// Dedup: an alert fires once when it crosses (triggeredAt stamped), and
// re-arms automatically when price crosses back to the safe side — so you
// get one message per crossing, not one every sweep.
export async function GET(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  const url = new URL(req.url)
  const provided = url.searchParams.get('secret') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (provided !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, skipped: 'telegram not configured' })
  }

  const sb = createServiceSupabase()
  const { data: rows, error } = await sb.from('app_state').select('user_id, data')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let checked = 0, fired = 0, rearmed = 0
  for (const row of rows || []) {
    const state = row.data || {}
    const alerts = Array.isArray(state.alerts) ? state.alerts : []
    const armed = alerts.filter((a) => a.active)
    if (!armed.length) continue

    const symbols = [...new Set(armed.map((a) => a.ticker))]
    const quotes = await getQuotes(symbols)
    checked += symbols.length

    let dirty = false
    for (const a of alerts) {
      if (!a.active) continue
      const q = quotes[a.ticker]
      if (!q || q.error || q.price == null) continue
      const hit = a.condition === 'below' ? q.price <= a.price : q.price >= a.price
      if (hit && !a.triggeredAt) {
        const res = await sendTelegram(formatAlertHit({ ...a, currentPrice: q.price }))
        if (res.ok) { a.triggeredAt = new Date().toISOString(); dirty = true; fired++ }
      } else if (!hit && a.triggeredAt) {
        a.triggeredAt = null; dirty = true; rearmed++ // crossed back → re-arm
      }
    }

    if (dirty) {
      await sb.from('app_state').update({ data: state, updated_at: new Date().toISOString() }).eq('user_id', row.user_id)
    }
  }

  return NextResponse.json({ ok: true, checked, fired, rearmed })
}
