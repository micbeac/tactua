// Envoi des emails basés sur les templates stockés en DB (table email_templates).
// Différent de templates.ts qui contient les templates HTML hardcodés des
// notifications match (compo / kickoff / résultat).

import { createAdminClient } from '@/lib/supabase/admin';

type Vars = Record<string, string | number | undefined | null>;

function renderTemplate(body: string, vars: Vars): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

function markdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const withBold = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const withLinks = withBold.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  );
  const paragraphs = withLinks
    .split(/\n\n+/)
    .map((p) => {
      const lines = p.split('\n');
      if (lines.every((l) => l.trim().startsWith('- '))) {
        const items = lines
          .map((l) => `<li>${l.replace(/^- /, '').trim()}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
  return paragraphs;
}

export async function sendTemplatedEmail(
  templateKey: string,
  to: string,
  vars: Vars = {},
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@tactuo.com';
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY missing, skipping send');
    return { ok: false, error: 'no_api_key' };
  }

  const admin = createAdminClient();
  const { data: template } = await admin
    .from('email_templates')
    .select('subject, body_md, is_active')
    .eq('key', templateKey)
    .maybeSingle();

  if (!template) return { ok: false, error: 'template_not_found' };
  if (!template.is_active) return { ok: false, error: 'template_inactive' };

  const subject = renderTemplate(template.subject, vars);
  const body = renderTemplate(template.body_md, vars);
  const html = markdownToHtml(body);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[email] resend error', text);
      return { ok: false, error: text.slice(0, 200) };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
