// Email sender. Works with any mail server via SMTP (nodemailer), or with
// Resend's HTTP API if you'd rather not manage SMTP. Configure whichever you
// have; SMTP takes priority.
//
//   SMTP:   SMTP_HOST, SMTP_PORT (587/465), SMTP_USER, SMTP_PASS, MAIL_FROM
//   Resend: RESEND_API_KEY, MAIL_FROM
import 'server-only'
import { renderEmail, renderText } from './emailTemplate'

const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
const resendConfigured = () => !!process.env.RESEND_API_KEY
export const mailConfigured = () => (smtpConfigured() || resendConfigured()) && !!mailFrom()
function mailFrom() { return process.env.MAIL_FROM || process.env.SMTP_USER || null }

// Lazily create the SMTP transport (kept module-level so warm instances reuse it).
let _transport = null
async function smtpTransport() {
  if (_transport) return _transport
  const nodemailer = (await import('nodemailer')).default
  const port = Number(process.env.SMTP_PORT || 587)
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return _transport
}

async function sendViaSmtp({ to, subject, html, text }) {
  const t = await smtpTransport()
  await t.sendMail({ from: mailFrom(), to, subject, html, text })
  return { ok: true }
}

async function sendViaResend({ to, subject, html, text }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: mailFrom(), to: [to], subject, html, text }),
  })
  if (!r.ok) return { ok: false, error: `resend ${r.status}` }
  return { ok: true }
}

// Low-level send. Returns {ok, error?}; never throws.
export async function sendMail({ to, subject, html, text }) {
  if (!to) return { ok: false, error: 'no recipient' }
  if (!mailConfigured()) return { ok: false, error: 'mail not configured' }
  try {
    return smtpConfigured() ? await sendViaSmtp({ to, subject, html, text }) : await sendViaResend({ to, subject, html, text })
  } catch (e) { return { ok: false, error: e.message } }
}

// High-level: render the branded template + plaintext fallback and send.
export async function sendTemplatedMail({ to, subject, title, intro, rows, footer, accent }) {
  const html = renderEmail({ title, intro, rows, footer, accent })
  const text = renderText({ title, intro, rows, footer })
  return sendMail({ to, subject, html, text })
}
