/**
 * Shared email helpers for Edge Functions (S12).
 * Sends through the Resend HTTP API and wraps every message in the Martial CRM layout.
 * Env: RESEND_API_KEY (required), EMAIL_FROM (e.g. "Martial CRM <hola@tudominio.cl>").
 */

export type EmailMessage = { to: string; subject: string; html: string; text: string; tags?: Record<string, string> }
export type SendResult = { ok: true; id: string } | { ok: false; error: string }

const DEFAULT_FROM = 'Martial CRM <onboarding@resend.dev>'

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') || DEFAULT_FROM,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      tags: Object.entries(msg.tags ?? {}).map(([name, value]) => ({ name, value })),
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: String(body?.message ?? `HTTP ${res.status}`) }
  return { ok: true, id: String(body.id) }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

type LayoutInput = { eyebrow?: string; title: string; paragraphs: string[]; cta?: { label: string; url: string }; footnote?: string }

/** Email-safe layout (tables + inline styles). Paragraphs are plain text and get escaped. */
export function layout({ eyebrow, title, paragraphs, cta, footnote }: LayoutInput): { html: string; text: string } {
  const year = new Date().getFullYear()
  const p = paragraphs.map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3a3a40">${escapeHtml(t)}</p>`).join('')
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:#19191c;border-radius:5px">
         <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(cta.label)}</a>
       </td></tr></table>`
    : ''
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Inter Tight',Inter,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 4px 16px;font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#19191c">Martial CRM<span style="color:#e0492c">.</span></td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e4e4e9;border-radius:12px;padding:32px 28px">
      ${eyebrow ? `<p style="margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#e0492c">● ${escapeHtml(eyebrow)}</p>` : ''}
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#19191c">${escapeHtml(title)}</h1>
      ${p}${button}
      ${footnote ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#7a7a82">${escapeHtml(footnote)}</p>` : ''}
    </td></tr>
    <tr><td style="padding:16px 4px;font-size:12px;color:#8a8a92">© ${year} Martial CRM</td></tr>
  </table>
</td></tr></table></body></html>`
  const text = [eyebrow, title, '', ...paragraphs, cta ? `${cta.label}: ${cta.url}` : '', footnote ?? '', '', `© ${year} Martial CRM`]
    .filter((l) => l !== undefined)
    .join('\n')
  return { html, text }
}
