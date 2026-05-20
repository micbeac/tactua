// Templates HTML minimalistes pour les 3 events de notification.
// Pas de framework email (React Email overkill ici) : juste du HTML inliné
// compatible Gmail / Outlook / Apple Mail.

const SITE_URL = 'https://tactua.vercel.app';

const ACCENT = '#22c55e';
const BG = '#0a0f1e';
const BG_CARD = '#111b28';
const FG = '#fafafa';
const MUTED = '#969fab';

type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

type MatchInfo = {
  id: number;
  home_team_name: string;
  away_team_name: string;
  competition_name: string | null;
  kickoff_at: string;
  score_home?: number | null;
  score_away?: number | null;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function shell(title: string, bodyHtml: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${FG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 0 24px 0;">
              <p style="margin:0;font-size:14px;color:${ACCENT};font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">
                ● Tactua
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:${BG_CARD};border-radius:16px;padding:32px;">
              ${bodyHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="background:${ACCENT};border-radius:8px;">
                    <a href="${ctaUrl}" style="display:inline-block;padding:12px 20px;color:${BG};font-weight:600;font-size:14px;text-decoration:none;">
                      Voir le match →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:${MUTED};">
                Tu reçois cet email car tu suis ce match ou l&apos;une des équipes.<br>
                <a href="${SITE_URL}/favoris" style="color:${MUTED};">Gérer mes favoris</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildLineupConfirmedEmail(m: MatchInfo): EmailContent {
  const date = DATE_FMT.format(new Date(m.kickoff_at));
  const ctaUrl = `${SITE_URL}/matches/${m.id}`;
  const competition = m.competition_name ? ` · ${m.competition_name}` : '';

  const subject = `Compo officielle : ${m.home_team_name} - ${m.away_team_name}`;
  const body = `
    <p style="margin:0 0 8px 0;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.05em;">Composition officielle</p>
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:600;line-height:1.3;">
      ${m.home_team_name} <span style="color:${MUTED};">vs</span> ${m.away_team_name}
    </h1>
    <p style="margin:0 0 16px 0;font-size:14px;color:${MUTED};">${date}${competition}</p>
    <p style="margin:0;font-size:15px;line-height:1.5;">
      La composition officielle vient d&apos;être publiée. L&apos;analyse pré-match IA est disponible dès maintenant sur la fiche du match.
    </p>`;
  const text = `Composition officielle\n\n${m.home_team_name} vs ${m.away_team_name}\n${date}${competition}\n\nLa composition officielle vient d'être publiée.\n\nVoir le match : ${ctaUrl}`;
  return { subject, html: shell(subject, body, ctaUrl), text };
}

export function buildKickoffEmail(m: MatchInfo): EmailContent {
  const ctaUrl = `${SITE_URL}/matches/${m.id}`;
  const competition = m.competition_name ? ` · ${m.competition_name}` : '';

  const subject = `Coup d'envoi : ${m.home_team_name} - ${m.away_team_name}`;
  const body = `
    <p style="margin:0 0 8px 0;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.05em;">Coup d&apos;envoi imminent</p>
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:600;line-height:1.3;">
      ${m.home_team_name} <span style="color:${MUTED};">vs</span> ${m.away_team_name}
    </h1>
    <p style="margin:0 0 16px 0;font-size:14px;color:${MUTED};">C&apos;est parti${competition}.</p>
    <p style="margin:0;font-size:15px;line-height:1.5;">
      Le match démarre maintenant. Suis le score en direct sur la fiche.
    </p>`;
  const text = `Coup d'envoi\n\n${m.home_team_name} vs ${m.away_team_name}${competition}\n\nLe match démarre maintenant.\n\nVoir le match : ${ctaUrl}`;
  return { subject, html: shell(subject, body, ctaUrl), text };
}

export function buildFinalScoreEmail(m: MatchInfo): EmailContent {
  const ctaUrl = `${SITE_URL}/matches/${m.id}`;
  const competition = m.competition_name ? ` · ${m.competition_name}` : '';
  const scoreLine =
    m.score_home != null && m.score_away != null
      ? `${m.score_home} - ${m.score_away}`
      : '? - ?';

  const subject = `Résultat : ${m.home_team_name} ${scoreLine} ${m.away_team_name}`;
  const body = `
    <p style="margin:0 0 8px 0;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.05em;">Match terminé</p>
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;line-height:1.3;">
      ${m.home_team_name} <span style="color:${ACCENT};font-weight:700;">${scoreLine}</span> ${m.away_team_name}
    </h1>
    <p style="margin:0 0 16px 0;font-size:14px;color:${MUTED};">${competition.replace(' · ', '')}</p>
    <p style="margin:0;font-size:15px;line-height:1.5;">
      Le match est terminé. L&apos;analyse post-match IA est disponible : faits marquants, homme du match, lecture tactique.
    </p>`;
  const text = `Résultat final\n\n${m.home_team_name} ${scoreLine} ${m.away_team_name}${competition}\n\nVoir l'analyse : ${ctaUrl}`;
  return { subject, html: shell(subject, body, ctaUrl), text };
}
