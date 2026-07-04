// Service-role helpers for the per-user Telegram link table.
// The webhook (no user session) and the alert cron both use these.
import 'server-only'
import { createServiceSupabase } from '../supabase/server'

// Find a Supabase auth user by email (case-insensitive). Uses the admin API;
// paginates so it works as the user base grows.
export async function findUserByEmail(email) {
  const target = String(email || '').trim().toLowerCase()
  if (!target) return null
  const sb = createServiceSupabase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) return null
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 200) return null // last page
  }
  return null
}

export async function saveTelegramLink(userId, chatId, email) {
  const sb = createServiceSupabase()
  const { error } = await sb.from('telegram_links').upsert(
    { user_id: userId, chat_id: String(chatId), email: email || null, linked_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  return !error
}

export async function getTelegramLink(userId) {
  const sb = createServiceSupabase()
  const { data } = await sb.from('telegram_links').select('chat_id, email, linked_at').eq('user_id', userId).maybeSingle()
  return data || null
}

// user_id -> chat_id map for the cron sweep (one query, not one per user).
export async function allTelegramLinks() {
  const sb = createServiceSupabase()
  const { data } = await sb.from('telegram_links').select('user_id, chat_id')
  const map = {}
  for (const r of data || []) map[r.user_id] = r.chat_id
  return map
}
