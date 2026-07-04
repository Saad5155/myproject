// Telegram push notifications — free, instant, works when the app is closed.
// Server-side only. Requires TELEGRAM_BOT_TOKEN (from @BotFather) and the
// destination TELEGRAM_CHAT_ID (auto-discoverable via getUpdates below).
import 'server-only'

const API = 'https://api.telegram.org'

export function telegramConfigured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}
export function telegramBotConfigured() {
  return !!process.env.TELEGRAM_BOT_TOKEN
}

// Send a message. HTML parse mode (bold/emoji safe). Returns {ok, error?}.
export async function sendTelegram(text, chatId = process.env.TELEGRAM_CHAT_ID) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' }
  if (!chatId) return { ok: false, error: 'TELEGRAM_CHAT_ID not set' }
  try {
    const r = await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
    const j = await r.json()
    if (!j.ok) return { ok: false, error: j.description || 'telegram error' }
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
}

// Register the webhook so Telegram delivers messages to our route. Owner runs
// this once (via /api/telegram/setup). secretToken is echoed back by Telegram
// in the X-Telegram-Bot-Api-Secret-Token header so we can verify authenticity.
export async function setWebhook(url, secretToken) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' }
  try {
    const r = await fetch(`${API}/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, secret_token: secretToken, allowed_updates: ['message'], drop_pending_updates: true }),
    })
    const j = await r.json()
    return j.ok ? { ok: true } : { ok: false, error: j.description || 'setWebhook failed' }
  } catch (e) { return { ok: false, error: e.message } }
}

// Discover the chat_id: the user DMs the bot once, then we read the most recent
// update. Lets the app show "your chat id is 12345 — add it to TELEGRAM_CHAT_ID".
export async function discoverChatId() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  try {
    const r = await fetch(`${API}/bot${token}/getUpdates`)
    const j = await r.json()
    if (!j.ok || !Array.isArray(j.result) || !j.result.length) return null
    for (let i = j.result.length - 1; i >= 0; i--) {
      const msg = j.result[i].message || j.result[i].edited_message || j.result[i].channel_post
      const id = msg?.chat?.id
      if (id != null) return String(id)
    }
    return null
  } catch { return null }
}

// ---- message formatters ----
const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export function formatAlertHit(a) {
  const dir = a.condition === 'below' ? '🔻 BELOW' : '🔺 ABOVE'
  return `⚠️ <b>ALERT — ${a.ticker}</b>\n${dir} ${money(a.price)}\nNow: <b>${money(a.currentPrice)}</b>`
}

export function formatLogin({ email, when, device }) {
  return `🔓 <b>Sign-in to Terminal X</b>\nAccount: ${email || '—'}\nTime: ${when}${device ? `\nDevice: ${device}` : ''}\n\nIf this wasn’t you, change your password.`
}
