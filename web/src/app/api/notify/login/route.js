import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { sendTelegram, formatLogin, telegramBotConfigured } from '@/lib/server/telegram'
import { getTelegramLink } from '@/lib/server/telegramLinks'
import { sendTemplatedMail, mailConfigured } from '@/lib/server/mailer'

export const maxDuration = 20

// POST /api/notify/login — best-effort sign-in alert over Telegram AND email.
// Called right after a successful login. Never blocks the UI: always returns ok,
// silently no-ops for whichever channel isn't configured/linked.
export async function POST(req) {
  const user = await getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const ua = req.headers.get('user-agent') || ''
  const device = /iphone|ipad/i.test(ua) ? 'iPhone/iPad'
    : /android/i.test(ua) ? 'Android'
      : /macintosh|mac os/i.test(ua) ? 'Mac'
        : /windows/i.test(ua) ? 'Windows'
          : /linux/i.test(ua) ? 'Linux' : null
  const when = new Date().toLocaleString('en-US', { timeZone: 'UTC', hour12: false }) + ' UTC'

  const jobs = []
  // Telegram
  if (telegramBotConfigured()) {
    jobs.push((async () => {
      const link = await getTelegramLink(user.id)
      if (link) await sendTelegram(formatLogin({ email: user.email, when, device }), link.chat_id)
    })())
  }
  // Email
  if (mailConfigured() && user.email) {
    jobs.push(sendTemplatedMail({
      to: user.email,
      subject: 'Terminal X — new sign-in',
      title: 'New sign-in to your account',
      intro: 'A sign-in to Terminal X was just detected.',
      rows: [
        { label: 'Account', value: user.email },
        { label: 'Time', value: when },
        ...(device ? [{ label: 'Device', value: device }] : []),
      ],
      footer: 'If this wasn’t you, change your password immediately.',
      accent: 'amber',
    }))
  }

  const results = await Promise.allSettled(jobs)
  return NextResponse.json({ ok: true, channels: results.length })
}
