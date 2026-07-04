import { NextResponse } from 'next/server'
import { setWebhook, telegramBotConfigured } from '@/lib/server/telegram'

export const maxDuration = 20

// GET /api/telegram/setup?secret=CRON_SECRET
// Owner runs this once after deploy to point the bot at our webhook.
// Uses the request's own origin, so it works on any deployment URL.
export async function GET(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  const url = new URL(req.url)
  if (url.searchParams.get('secret') !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!telegramBotConfigured()) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 503 })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin
  const webhookUrl = `${origin.replace(/\/$/, '')}/api/telegram/webhook`
  const res = await setWebhook(webhookUrl, secret)
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 502 })
  return NextResponse.json({ ok: true, webhook: webhookUrl })
}
