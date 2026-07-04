// Server-side Claude client. Runs ONLY in API routes — the key never reaches the browser.
import 'server-only'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const WEB_SEARCH_TOOL = 'web_search_20260209'

export function getModel() {
  return process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
}
export function aiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY
}

// Default under the 60s serverless cap so calls abort gracefully (catchable)
// instead of the platform 504-ing the whole function.
async function callAnthropic(body, timeoutMs = 52000) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) { const e = new Error('ANTHROPIC_API_KEY not set on the server.'); e.status = 503; throw e }
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 400) } catch { /* noop */ }
    const e = new Error(`Claude API ${res.status}: ${detail}`)
    e.status = res.status
    throw e
  }
  return res.json()
}

function extractText(msg) {
  return (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
}

export async function askClaude(prompt, { system, maxTokens = 2048 } = {}) {
  const msg = await callAnthropic({ model: getModel(), max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] })
  return extractText(msg)
}

export async function askClaudeWithSearch(prompt, { system, maxTokens = 4096, maxUses = 6, timeoutMs } = {}) {
  const messages = [{ role: 'user', content: prompt }]
  const tools = [{ type: WEB_SEARCH_TOOL, name: 'web_search', max_uses: maxUses }]
  let msg
  for (let i = 0; i < 4; i++) {
    msg = await callAnthropic({ model: getModel(), max_tokens: maxTokens, system, messages, tools }, timeoutMs)
    if (msg.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: msg.content }); continue }
    break
  }
  return extractText(msg)
}

export async function parseScreenshot(base64Data, mediaType) {
  const msg = await callAnthropic({
    model: getModel(), max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        {
          type: 'text',
          text:
            'This is a screenshot of a brokerage app / portfolio. Extract every stock position you can read. ' +
            'Return ONLY a JSON array, no prose, no code fences. Each element: ' +
            '{"ticker":"SYMBOL","shares":number,"buyPrice":number}. buyPrice = average cost per share if visible, ' +
            'else best estimate from the data shown, else null. Skip cash, options, and crypto unless clearly a stock ticker.',
        },
      ],
    }],
  })
  return parseJSONLoose(extractText(msg))
}

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
