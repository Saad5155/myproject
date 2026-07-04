import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { askClaude, askClaudeWithSearch } from '@/lib/server/anthropic'

export const maxDuration = 300 // web-search + deep-dive calls can run long

export async function POST(req) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const { prompt, system, maxTokens, maxUses, search } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
    const text = search
      ? await askClaudeWithSearch(prompt, { system, maxTokens, maxUses })
      : await askClaude(prompt, { system, maxTokens })
    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
