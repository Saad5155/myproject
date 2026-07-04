import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { sendTelegram, telegramBotConfigured } from '@/lib/server/telegram'
import { getTelegramLink } from '@/lib/server/telegramLinks'

export const maxDuration = 20

// GET  /api/notify/test — report this user's Telegram link status + bot handle.
// POST /api/notify/test — send a test message to this user's linked chat.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const link = telegramBotConfigured() ? await getTelegramLink(user.id) : null
  return NextResponse.json({
    botConfigured: telegramBotConfigured(),
    bot: process.env.TELEGRAM_BOT_USERNAME || null,
    linked: !!link,
    email: user.email || null,
  })
}

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!telegramBotConfigured()) {
    return NextResponse.json({ ok: false, error: 'Telegram bot not set up on the server yet.' })
  }
  const link = await getTelegramLink(user.id)
  if (!link) {
    const bot = process.env.TELEGRAM_BOT_USERNAME
    return NextResponse.json({
      ok: false,
      needsLink: true,
      error: `Not linked yet. Open Telegram${bot ? `, message @${bot}` : ' and message your bot'}, and send your account email: ${user.email}`,
    })
  }
  const res = await sendTelegram('✅ <b>Test alert.</b> Your terminal notifications are working.', link.chat_id)
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error })
  return NextResponse.json({ ok: true })
}
