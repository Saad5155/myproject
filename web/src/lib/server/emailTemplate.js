// Branded HTML email template — terminal aesthetic, inline styles + table
// layout for broad email-client compatibility (Gmail/Outlook/Apple Mail).
import 'server-only'

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// rows: [{ label, value, color? }] ; accent: 'green' | 'amber' | 'red'
export function renderEmail({ title, intro, rows = [], footer, accent = 'green' }) {
  const AC = accent === 'red' ? '#ff3b5c' : accent === 'amber' ? '#ffb000' : '#2bff88'
  const rowHtml = rows.map((r) => `
    <tr>
      <td style="padding:6px 0;color:#6f9e80;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">${esc(r.label)}</td>
      <td style="padding:6px 0;color:${r.color || '#e6ffe6'};font-size:15px;font-weight:700;text-align:right;font-family:'SFMono-Regular',Consolas,monospace;">${esc(r.value)}</td>
    </tr>`).join('')

  return `<!doctype html>
<html><body style="margin:0;background:#03060a;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#070d09;border:1px solid #143b1f;border-radius:10px;overflow:hidden;">
    <tr><td style="padding:16px 20px;border-bottom:1px solid #143b1f;background:#0a140b;">
      <span style="color:#2bff88;font-weight:800;letter-spacing:.14em;font-size:15px;">TERMINAL&nbsp;<span style="color:#ffb000;">X</span></span>
    </td></tr>
    <tr><td style="padding:22px 20px;">
      <div style="color:${AC};font-size:18px;font-weight:700;margin:0 0 8px;">${esc(title)}</div>
      ${intro ? `<div style="color:#b7d8c2;font-size:14px;line-height:1.5;margin:0 0 16px;">${esc(intro)}</div>` : ''}
      ${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #10281a;border-bottom:1px solid #10281a;margin:4px 0 8px;">${rowHtml}</table>` : ''}
      ${footer ? `<div style="color:#5f8f70;font-size:12px;line-height:1.5;margin-top:16px;">${esc(footer)}</div>` : ''}
    </td></tr>
    <tr><td style="padding:12px 20px;border-top:1px solid #143b1f;background:#0a140b;color:#3f6a4f;font-size:11px;">
      Terminal X · automated notification · do not reply
    </td></tr>
  </table>
</body></html>`
}

// Plain-text fallback for clients that don't render HTML.
export function renderText({ title, intro, rows = [], footer }) {
  const lines = [`TERMINAL X`, '', title]
  if (intro) lines.push('', intro)
  if (rows.length) { lines.push(''); rows.forEach((r) => lines.push(`${r.label}: ${r.value}`)) }
  if (footer) lines.push('', footer)
  return lines.join('\n')
}
