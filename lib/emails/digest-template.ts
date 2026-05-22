import { SITE_URL } from '@/lib/site';
import type { FeedItem } from '@/lib/data/for-you-feed';
import { createAdminClient } from '@/lib/supabase/admin';

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
});

const TIME_FMT = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

// Lit le template daily_digest depuis la DB (sujet + intro/outro éditables
// depuis /admin/emails). Fallback sur les valeurs en dur si la table est vide.
async function loadDigestTemplate(): Promise<{
  subject: string;
  body_md: string;
} | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('email_templates')
      .select('subject, body_md, is_active')
      .eq('key', 'daily_digest')
      .maybeSingle();
    if (!data || !data.is_active) return null;
    return { subject: data.subject, body_md: data.body_md };
  } catch {
    return null;
  }
}

function applyVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

/**
 * Génère le HTML d'un digest matinal.
 * Volontairement compatible avec les principaux clients mail (table-based,
 * inline styles). On n'utilise PAS React Email côté MVP — du HTML brut suffit.
 *
 * Sujet et intro/outro (le texte autour de la liste) sont configurables
 * depuis /admin/emails. La liste elle-même reste générée dynamiquement.
 */
export async function renderDailyDigest(params: {
  user_label: string | null;
  feed: FeedItem[];
  matches_today_count: number;
  unsubscribe_url: string;
}): Promise<{ subject: string; html: string; text: string }> {
  const { user_label, feed, matches_today_count, unsubscribe_url } = params;

  const today = DATE_FMT.format(new Date());
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);
  const greeting = user_label
    ? `Salut ${user_label} 👋`
    : 'Bonjour 👋';

  // Sujet : DB > fallback contextuel
  const tpl = await loadDigestTemplate();
  const fallbackSubject = matches_today_count > 0
    ? `🏟️ ${matches_today_count} match${matches_today_count > 1 ? 's' : ''} aujourd'hui — Ton digest Tactuo`
    : '☕ Ton foot du jour — Tactuo';
  const subject = tpl
    ? applyVars(tpl.subject, {
        greeting,
        matches_count: String(matches_today_count),
        date: todayLabel,
      })
    : fallbackSubject;

  // Intro/outro depuis le template (séparés par {{items}})
  let introText = '';
  let outroText = '';
  if (tpl) {
    const parts = tpl.body_md.split(/\{\{\s*items\s*\}\}/);
    introText = applyVars(parts[0] ?? '', { greeting });
    outroText = applyVars(parts[1] ?? '', { greeting });
  }

  // On garde max 5 items dans l'email (le reste est sur le site)
  const featured = feed.slice(0, 5);

  const itemsHtml = featured.map((item) => renderFeedItem(item)).join('\n');

  const introHtml = introText ? mdInlineToHtml(introText) : '';
  const outroHtml = outroText ? mdInlineToHtml(outroText) : '';

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a1428;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a1428;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#152040;border-radius:16px;overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="padding:28px 32px 16px;background:linear-gradient(135deg,#1a2854 0%,#152040 100%);">
                <p style="margin:0 0 8px;color:#22c55e;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${todayLabel}</p>
                <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.2;">${greeting}</h1>
                <p style="margin:8px 0 0;color:#a8b4d4;font-size:14px;">Voici ton foot du jour</p>
              </td>
            </tr>

            ${introHtml ? `
            <!-- Intro éditable -->
            <tr>
              <td style="padding:16px 32px 0;color:#d1d5db;font-size:14px;line-height:1.55;">
                ${introHtml}
              </td>
            </tr>` : ''}

            <!-- Items -->
            <tr>
              <td style="padding:8px 32px 24px;">
                ${itemsHtml || '<p style="color:#a8b4d4;text-align:center;padding:32px 0;font-size:14px;">Pas grand-chose à signaler aujourd\'hui. Profite du calme avant la tempête de la Coupe du Monde 🌍</p>'}
              </td>
            </tr>

            ${outroHtml ? `
            <!-- Outro éditable -->
            <tr>
              <td style="padding:0 32px 8px;color:#d1d5db;font-size:14px;line-height:1.55;">
                ${outroHtml}
              </td>
            </tr>` : ''}

            <!-- CTA -->
            <tr>
              <td style="padding:0 32px 32px;text-align:center;">
                <a href="${SITE_URL}" style="display:inline-block;background-color:#22c55e;color:#0a1428;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;">
                  Ouvrir Tactuo
                </a>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;background-color:#0d1838;border-top:1px solid #22c55e22;">
                <p style="margin:0 0 6px;color:#a8b4d4;font-size:12px;line-height:1.5;">
                  Tu reçois cet email parce que tu as un compte Tactuo. L'analyse foot augmentée par l'IA.
                </p>
                <p style="margin:0;color:#7d8db5;font-size:11px;">
                  <a href="${unsubscribe_url}" style="color:#a8b4d4;text-decoration:underline;">Se désabonner du digest matinal</a>
                  &nbsp;·&nbsp;
                  <a href="${SITE_URL}" style="color:#a8b4d4;text-decoration:underline;">tactuo.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // Version texte basique pour les clients qui ne rendent pas le HTML
  const textLines: string[] = [];
  textLines.push(`${todayLabel} — ${greeting}`);
  textLines.push('');
  textLines.push('Voici ton foot du jour :');
  textLines.push('');
  for (const item of featured) {
    textLines.push(`• ${textForItem(item)}`);
  }
  textLines.push('');
  textLines.push(`Ouvre Tactuo : ${SITE_URL}`);
  textLines.push('');
  textLines.push(`Se désabonner : ${unsubscribe_url}`);

  return { subject, html, text: textLines.join('\n') };
}

function renderFeedItem(item: FeedItem): string {
  const baseStyle =
    'border:1px solid #22c55e22;border-radius:10px;padding:14px 16px;margin:8px 0;';

  if (item.type === 'upcoming_match') {
    const m = item.match;
    const home = m.home_team?.name ?? 'À déterminer';
    const away = m.away_team?.name ?? 'À déterminer';
    const time = TIME_FMT.format(new Date(m.kickoff_at));
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a2854;${baseStyle}">
  <tr><td>
    <p style="margin:0 0 6px;color:#22c55e;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">⏰ À venir · ${m.competition?.name ?? '—'}</p>
    <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${home} vs ${away}</p>
    <p style="margin:6px 0 0;color:#a8b4d4;font-size:12px;">${time}${m.matchday != null ? ` · J${m.matchday}` : ''}</p>
    <a href="${SITE_URL}/matches/${m.id}#analyse" style="color:#22c55e;font-size:12px;font-weight:600;text-decoration:none;">→ Analyser ce match</a>
  </td></tr>
</table>`;
  }

  if (item.type === 'recent_result') {
    const r = item.result;
    const accentColor = r.result === 'W' ? '#22c55e' : r.result === 'L' ? '#ef4444' : '#f59e0b';
    const accent =
      r.result === 'W' ? '🏆 Victoire' : r.result === 'L' ? '🔴 Défaite' : '🟰 Nul';
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a2854;${baseStyle}border-left:3px solid ${accentColor};">
  <tr><td>
    <p style="margin:0 0 6px;color:${accentColor};font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${accent} · ${r.competition_name ?? '—'}</p>
    <p style="margin:0;color:#ffffff;font-size:14px;font-weight:600;">
      ${r.favorite_team.name} <span style="color:${accentColor};">${r.goals_for}–${r.goals_against}</span> ${r.opponent.name}
    </p>
  </td></tr>
</table>`;
  }

  if (item.type === 'news') {
    const n = item.news;
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a2854;${baseStyle}">
  <tr><td>
    <p style="margin:0 0 6px;color:#22c55e;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">📰 ${n.team_name}</p>
    <a href="${n.url ?? '#'}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;line-height:1.4;">${escapeHtml(n.title)}</a>
  </td></tr>
</table>`;
  }

  if (item.type === 'player_reco') {
    const p = item.player;
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a2854;${baseStyle}">
  <tr><td>
    <p style="margin:0 0 6px;color:#22c55e;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">✨ Suggestion</p>
    <p style="margin:0;color:#ffffff;font-size:14px;font-weight:600;">${p.name}</p>
    <p style="margin:4px 0 0;color:#a8b4d4;font-size:12px;">${p.reason} · ${p.goals}b/${p.assists}a</p>
    <a href="${SITE_URL}/players/${p.player_id}" style="color:#22c55e;font-size:11px;font-weight:600;text-decoration:none;">→ Voir le profil</a>
  </td></tr>
</table>`;
  }

  return '';
}

function textForItem(item: FeedItem): string {
  if (item.type === 'upcoming_match') {
    const time = TIME_FMT.format(new Date(item.match.kickoff_at));
    return `À ${time} · ${item.match.home_team?.name ?? '?'} vs ${item.match.away_team?.name ?? '?'}`;
  }
  if (item.type === 'recent_result') {
    const r = item.result;
    return `${r.favorite_team.name} ${r.goals_for}-${r.goals_against} ${r.opponent.name}`;
  }
  if (item.type === 'news') {
    return `[${item.news.team_name}] ${item.news.title}`;
  }
  if (item.type === 'player_reco') {
    return `Suggestion : ${item.player.name} (${item.player.reason})`;
  }
  return '';
}

// Mini-markdown pour les sections intro/outro éditables : titres, gras,
// liens, paragraphes. Pas de table complète, pas de listes — pour rester
// safe dans les clients mail.
function mdInlineToHtml(md: string): string {
  const safe = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const withBold = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const withLinks = withBold.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#22c55e;text-decoration:underline;">$1</a>',
  );
  return withLinks
    .split(/\n\n+/)
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('## ')) {
        return `<h2 style="margin:8px 0;color:#ffffff;font-size:18px;font-weight:600;">${trimmed.slice(3)}</h2>`;
      }
      if (trimmed.startsWith('# ')) {
        return `<h1 style="margin:8px 0;color:#ffffff;font-size:22px;font-weight:700;">${trimmed.slice(2)}</h1>`;
      }
      return `<p style="margin:8px 0;">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
