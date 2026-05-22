import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';

// Image OG dynamique par match — affichée quand un lien /matches/[id] est
// partagé (réseaux sociaux, messageries). Générée à la volée par next/og.

export const alt = 'Affiche du match — Tactuo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0d1620';
const CARD = '#16212e';
const GREEN = '#34d977';
const MUTED = '#8b9bb0';

type OgTeam = { name: string; tla: string | null; logo_url: string | null };

type OgMatch = {
  status: string;
  kickoff_at: string;
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  competition: { name: string } | null;
  home_team: OgTeam | null;
  away_team: OgTeam | null;
};

async function getOgMatch(id: number): Promise<OgMatch | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('matches')
    .select(
      `status, kickoff_at, stage, matchday, score_home, score_away,
       competition:competitions(name),
       home_team:teams!matches_home_team_id_fkey(name, tla, logo_url),
       away_team:teams!matches_away_team_id_fkey(name, tla, logo_url)`,
    )
    .eq('id', id)
    .maybeSingle();
  return (data as unknown as OgMatch | null) ?? null;
}

function formatKickoff(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function TeamBlock({ team }: { team: OgTeam | null }) {
  const name = team?.name ?? 'À déterminer';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 360,
      }}
    >
      {team?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo_url}
          alt=""
          width={170}
          height={170}
          style={{ objectFit: 'contain' }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            width: 170,
            height: 170,
            borderRadius: 24,
            background: CARD,
          }}
        />
      )}
      <div
        style={{
          marginTop: 28,
          fontSize: 40,
          fontWeight: 700,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.15,
        }}
      >
        {name}
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getOgMatch(Number(id));

  const home = match?.home_team ?? null;
  const away = match?.away_team ?? null;
  const competition = match?.competition?.name ?? 'Football';
  const isFinished = match?.status === 'finished';
  const isLive = match?.status === 'live';

  const centerText = !match
    ? 'VS'
    : isFinished || isLive
      ? `${match.score_home ?? 0} - ${match.score_away ?? 0}`
      : 'VS';

  const subLine = !match
    ? ''
    : isLive
      ? 'EN DIRECT'
      : isFinished
        ? 'Terminé'
        : formatKickoff(match.kickoff_at);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: BG,
          padding: '56px 64px',
          justifyContent: 'space-between',
        }}
      >
        {/* En-tête : compétition */}
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            fontWeight: 700,
            color: GREEN,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {competition}
        </div>

        {/* Centre : équipes + score / VS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <TeamBlock team={home} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 88,
                fontWeight: 800,
                color: isLive ? GREEN : '#ffffff',
              }}
            >
              {centerText}
            </div>
            {subLine ? (
              <div
                style={{
                  display: 'flex',
                  marginTop: 12,
                  fontSize: 26,
                  color: isLive ? GREEN : MUTED,
                  fontWeight: 600,
                }}
              >
                {subLine}
              </div>
            ) : null}
          </div>
          <TeamBlock team={away} />
        </div>

        {/* Pied : branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 38,
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            Tactuo
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              color: MUTED,
            }}
          >
            Tout ce qu&apos;il faut comprendre avant le match
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
