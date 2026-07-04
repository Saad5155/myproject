'use client'
// Client AI wrappers — same names the components already import, but every call
// now goes to our Next.js API routes (the Claude key stays server-side).

async function postJSON(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* noop */ }
    throw new Error(msg)
  }
  return res.json()
}

// Keys live in server .env now — the client always attempts and surfaces server errors.
export function hasClaudeKey() { return true }
export function getModel() { return 'server' }

export async function askClaude(prompt, { system, maxTokens = 2048 } = {}) {
  const { text } = await postJSON('/api/ai', { prompt, system, maxTokens, search: false })
  return text
}

export async function askClaudeWithSearch(prompt, { system, maxTokens = 4096, maxUses = 6 } = {}) {
  const { text } = await postJSON('/api/ai', { prompt, system, maxTokens, maxUses, search: true })
  return text
}

export async function parseScreenshot(base64Data, mediaType) {
  const { result } = await postJSON('/api/ai/vision', { base64: base64Data, mediaType })
  return result
}

// Pure JSON extractor (mirrors the server copy) for parsing model text client-side.
export function parseJSONLoose(text) {
  if (!text) return null
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(t) } catch { /* keep trying */ }
  const firstObj = t.indexOf('{'), firstArr = t.indexOf('[')
  let start = -1, close = '}'
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) { start = firstArr; close = ']' }
  else if (firstObj !== -1) { start = firstObj; close = '}' }
  if (start >= 0) {
    const end = t.lastIndexOf(close)
    if (end > start) { try { return JSON.parse(t.slice(start, end + 1)) } catch { /* give up */ } }
  }
  return null
}
