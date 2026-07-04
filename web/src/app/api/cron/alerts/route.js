import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase/server'
import { getQuotes } from '@/lib/server/providers'
import { sendTelegram, formatAlertHit, telegramBotConfigured } from '@/lib/server/telegram'
import { allTelegramLinks, allUserEmails } from '@/lib/server/telegramLinks'
import { sendTemplatedMail, mailConfigured } from '@/lib/server/mailer'

const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

// Fire an alert across every available channel; true if at least one went out.
async function notifyHit(a, price, chatId, email) {
  const jobs = []
  if (chatId) jobs.push(sendTelegram(formatAlertHit({ ...a, currentPrice: price }), chatId))
  if (email && mailConfigured()) {
    const dir = a.condition === 'below' ? 'below' : 'above'
    jobs.push(sendTemplatedMail({
      to: email,
      subject: `Alert — ${a.ticker} ${dir} ${money(a.price)}`,
      title: `${a.ticker} is ${dir} your alert`,
      intro: `${a.ticker} crossed ${dir} ${money(a.price)}.`,
      rows: [
        { label: 'Ticker', value: a.ticker },
        { label: 'Condition', value: `${dir} ${money(a.price)}` },
        { label: 'Current', value: money(price), color: a.condition === 'below' ? '#ff3b5c' : '#2bff88' },
      ],
      accent: a.condition === 'below' ? 'red' : 'green',
    }))
  }
  if (!jobs.length) return false
  const res = await Promise.allSettled(jobs)
  return res.some((r) => r.status === 'fulfilled' && r.value?.ok)
}

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

  const canTelegram = telegramBotConfigured()
  const canEmail = mailConfigured()
  if (!canTelegram && !canEmail) {
    return NextResponse.json({ ok: false, skipped: 'no notification channel configured' })
  }

  const sb = createServiceSupabase()
  const [{ data: rows, error }, links, emails] = await Promise.all([
    sb.from('app_state').select('user_id, data'),
    canTelegram ? allTelegramLinks() : Promise.resolve({}),
    canEmail ? allUserEmails() : Promise.resolve({}),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let checked = 0, fired = 0, rearmed = 0, unlinked = 0
  for (const row of rows || []) {
    const state = row.data || {}
    const alerts = Array.isArray(state.alerts) ? state.alerts : []
    const armed = alerts.filter((a) => a.active)
    if (!armed.length) continue

    // Each user's alerts go to THEIR own Telegram chat and/or account email.
    const chatId = links[row.user_id]
    const email = emails[row.user_id]

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
        if (!chatId && !email) { unlinked++; continue } // no channel to reach this user
        const sent = await notifyHit(a, q.price, chatId, email)
        if (sent) { a.triggeredAt = new Date().toISOString(); dirty = true; fired++ }
      } else if (!hit && a.triggeredAt) {
        a.triggeredAt = null; dirty = true; rearmed++ // crossed back → re-arm
      }
    }

    if (dirty) {
      await sb.from('app_state').update({ data: state, updated_at: new Date().toISOString() }).eq('user_id', row.user_id)
    }
  }

  return NextResponse.json({ ok: true, checked, fired, rearmed, unlinked })
}
