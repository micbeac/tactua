import { ImageResponse } from 'next/og';
import { getPlayer } from '@/lib/data/player';
import { createClient } from '@/lib/supabase/server';
import { parseEntityId } from '@/lib/url';

// Image OG dynamique par joueur — aperçu social des pages /players/[slug].

export const alt = 'Fiche joueur — Tactuo';
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
  const player = id != null ? await getPlayer(supabase, id) : null;

  const name = player?.name ?? 'Joueur';
  const club = player?.current_team?.name ?? null;
  const facts = [
    player?.position ?? null,
    player?.nationality ?? null,
    player?.shirt_number ? `N°${player.shirt_number}` : null,
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
          Fiche joueur
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
          {player?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.photo_url}
              alt=""
              width={220}
              height={220}
              style={{ objectFit: 'cover', borderRadius: 28 }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                width: 220,
                height: 220,
                borderRadius: 28,
                background: CARD,
              }}
            />
          )}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 710,
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
            {club ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 24,
                }}
              >
                {player?.current_team?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.current_team.logo_url}
                    alt=""
                    width={48}
                    height={48}
                    style={{ objectFit: 'contain' }}
                  />
                ) : null}
                <div
                  style={{
                    display: 'flex',
                    fontSize: 32,
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  {club}
                </div>
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
            Stats de la saison et dernières performances
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
