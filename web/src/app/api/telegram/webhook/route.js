import { NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/server/telegram'
import { findUserByEmail, saveTelegramLink } from '@/lib/server/telegramLinks'

export const maxDuration = 20

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

// Telegram calls this on every incoming message. A user links their phone by
// sending the email their account was created with — we match it to the
// Supabase user and store their chat_id. Verified via the secret token that
// Telegram echoes back (set when we register the webhook).
export async function POST(req) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update
  try { update = await req.json() } catch { return NextResponse.json({ ok: true }) }
  const msg = update?.message || update?.edited_message
  const chatId = msg?.chat?.id
  const text = String(msg?.text || '').trim()
  if (!chatId) return NextResponse.json({ ok: true })

  // Always ack Telegram with 200 — errors are surfaced to the user as chat replies.
  if (/^\/start\b/.test(text) || !text) {
    await sendTelegram(
      '👋 <b>Terminal alerts</b>\nReply with the <b>email address your account was created with</b> to link this chat. Price alerts will then arrive here.',
      chatId
    )
    return NextResponse.json({ ok: true })
  }

  const email = (text.match(EMAIL_RE) || [])[0]
  if (!email) {
    await sendTelegram('Send the <b>email address of your terminal account</b> to link alerts to this chat.', chatId)
    return NextResponse.json({ ok: true })
  }

  const user = await findUserByEmail(email)
  if (!user) {
    await sendTelegram(`No terminal account found for <b>${email}</b>. Check the spelling, or ask the account owner to create it.`, chatId)
    return NextResponse.json({ ok: true })
  }

  const saved = await saveTelegramLink(user.id, chatId, user.email)
  await sendTelegram(
    saved
      ? `✅ <b>Linked.</b> Alerts for <b>${user.email}</b> will now arrive in this chat.`
      : 'Something went wrong saving the link. Please try again in a moment.',
    chatId
  )
  return NextResponse.json({ ok: true })
}
