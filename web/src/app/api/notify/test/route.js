import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { sendTelegram, discoverChatId, telegramBotConfigured } from '@/lib/server/telegram'

export const maxDuration = 20

// POST /api/notify/test — sends a "connected" message so the user can verify
// Telegram works, and surfaces their chat_id if TELEGRAM_CHAT_ID isn't set yet.
export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!telegramBotConfigured()) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set on the server.' })
  }

  let chatId = process.env.TELEGRAM_CHAT_ID
  let discovered = null
  if (!chatId) {
    discovered = await discoverChatId()
    chatId = discovered
    if (!chatId) {
      return NextResponse.json({
        ok: false,
        error: 'TELEGRAM_CHAT_ID not set. Open Telegram, send any message to your bot, then press "Send test" again.',
      })
    }
  }

  const res = await sendTelegram(
    '✅ <b>Terminal connected.</b>\nPrice alerts will arrive here.',
    chatId
  )
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error })

  return NextResponse.json({
    ok: true,
    ...(discovered ? { chatId: discovered, note: `Add TELEGRAM_CHAT_ID=${discovered} to your server env to make it permanent.` } : {}),
  })
}
