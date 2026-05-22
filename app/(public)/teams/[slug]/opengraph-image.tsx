import { ImageResponse } from 'next/og';
import { getTeam } from '@/lib/data/team';
import { createClient } from '@/lib/supabase/server';
import { parseEntityId } from '@/lib/url';

// Image OG dynamique par équipe — aperçu social des pages /teams/[slug].

export const alt = 'Fiche équipe — Tactuo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0d1620';
const CARD = '#16212e';
const GREEN = '#34d977';
const MUTED = '#8b9bb0';

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = parseEntityId(slug);
  const supabase = await createClient();
  const team = id != null ? await getTeam(supabase, id) : null;

  const name = team?.name ?? 'Équipe';
  const facts = [
    team?.country ?? null,
    team?.founded ? `Fondé en ${team.founded}` : null,
    team?.venue ?? null,
  ].filter(Boolean) as string[];

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
          Fiche équipe
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
          {team?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logo_url}
              alt=""
              width={230}
              height={230}
              style={{ objectFit: 'contain' }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                width: 230,
                height: 230,
                borderRadius: 28,
                background: CARD,
              }}
            />
          )}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 700,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 72,
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>
            {facts.length ? (
              <div
                style={{
                  display: 'flex',
                  marginTop: 20,
                  fontSize: 30,
                  color: MUTED,
                  fontWeight: 600,
                }}
              >
                {facts.join('  ·  ')}
              </div>
            ) : null}
          </div>
        </div>

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
          <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>
            Forme, classement et stats de la saison
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
