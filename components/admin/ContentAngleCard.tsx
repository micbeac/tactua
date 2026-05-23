'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CopyableBlock } from '@/components/admin/CopyableBlock';
import { Button } from '@/components/ui/button';
import {
  deleteAngle,
  markAnglePublished,
  markAngleProduced,
  rejectAngle,
  validateAngle,
} from '@/app/admin/contenu/actions';
import type {
  ContentAngleRow,
  ContentAngleVisual,
  ContentAngleSource,
} from '@/lib/data/content-angles';

const STATUS_LABEL: Record<string, string> = {
  pending: 'À valider',
  validated: 'Validé',
  produced: 'Produit',
  published: 'Publié',
  rejected: 'Rejeté',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300',
  validated: 'bg-primary/15 text-primary',
  produced: 'bg-blue-500/15 text-blue-300',
  published: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-muted text-muted-foreground',
};

const URGENCE_CLASS: Record<string, string> = {
  live: 'bg-destructive/20 text-destructive',
  '24h': 'bg-amber-500/20 text-amber-300',
  '72h': 'bg-muted text-muted-foreground',
  evergreen: 'bg-muted text-muted-foreground',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ContentAngleCard({ angle }: { angle: ContentAngleRow }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [publishMode, setPublishMode] = useState(false);
  const [tiktok, setTiktok] = useState('');
  const [insta, setInsta] = useState('');
  const [yt, setYt] = useState('');

  async function call(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fn();
      if (r.ok) {
        setMessage({ kind: 'ok', text: r.message ?? 'OK' });
        router.refresh();
      } else {
        setMessage({ kind: 'err', text: r.message ?? 'Échec' });
      }
    } finally {
      setBusy(false);
    }
  }

  const matchLabel = angle.match
    ? `${angle.match.home_team?.name ?? '?'} vs ${angle.match.away_team?.name ?? '?'} · ${fmtDate(angle.match.kickoff_at)}`
    : `Match #${angle.match_id}`;

  return (
    <li className="bg-card border-border overflow-hidden rounded-xl border">
      {/* Header — toujours visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="hover:bg-muted/30 flex w-full items-start justify-between gap-4 p-4 text-left transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span
              className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                STATUS_CLASS[angle.status] ?? ''
              }`}
            >
              {STATUS_LABEL[angle.status] ?? angle.status}
            </span>
            {angle.urgence && (
              <span
                className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                  URGENCE_CLASS[angle.urgence] ?? ''
                }`}
              >
                {angle.urgence}
              </span>
            )}
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 uppercase">
              {angle.format ?? 'angle'}
            </span>
            {angle.championnat && (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 uppercase">
                {angle.championnat}
              </span>
            )}
            {angle.generation_phase === 'pre_match' && (
              <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 uppercase">
                Avant-match
              </span>
            )}
            <span className="text-muted-foreground">{matchLabel}</span>
          </div>
          <p className="text-sm font-semibold leading-snug">
            {angle.hook ?? angle.title ?? `Angle #${angle.id}`}
          </p>
          {angle.narrative && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
              {angle.narrative}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {angle.score_viralite != null && (
            <div className="text-right">
              <p className="text-primary text-lg font-bold tabular-nums">
                {angle.score_viralite}
              </p>
              <p className="text-muted-foreground text-[9px] tracking-wide uppercase">
                Viralité
              </p>
            </div>
          )}
          <ChevronDown
            className={`text-muted-foreground size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>
      </button>

      {expanded && (
        <div className="border-border space-y-4 border-t p-4">
          {/* Data points clés */}
          {angle.data_points && angle.data_points.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
                Points clés
              </p>
              <ul className="text-foreground/90 list-disc space-y-1 pl-5 text-sm">
                {angle.data_points.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA Tactuo */}
          {angle.cta_tactuo && (
            <div className="bg-primary/5 border-primary/20 rounded-lg border p-3">
              <p className="text-primary mb-1 text-[10px] font-semibold tracking-wide uppercase">
                CTA Tactuo suggéré
              </p>
              <p className="text-sm">{angle.cta_tactuo}</p>
            </div>
          )}

          {/* 6 sections livrables avec copie */}
          <h3 className="text-sm font-semibold">📦 Livrables prêts à copier</h3>

          <Section title="📜 Script timecodé">
            {angle.script_timecode ? (
              <CopyableBlock
                label="Script"
                value={angle.script_timecode}
                mono
              />
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="🎙️ Prompt ElevenLabs (voix off)">
            {angle.prompt_elevenlabs ? (
              <CopyableBlock
                label="ElevenLabs"
                value={angle.prompt_elevenlabs}
              />
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="🎨 Prompts visuels IA (Leonardo / ChatGPT)">
            {angle.prompts_visuels_ia && angle.prompts_visuels_ia.length > 0 ? (
              <div className="space-y-2">
                {angle.prompts_visuels_ia.map((v: ContentAngleVisual, i: number) => (
                  <CopyableBlock
                    key={i}
                    label={`${v.outil.toUpperCase()} — ${v.moment_video} (${v.specs})`}
                    value={v.prompt}
                  />
                ))}
              </div>
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="🔍 Visuels à sourcer (Wikimedia, Pexels…)">
            {angle.sources_visuels_a_chercher &&
            angle.sources_visuels_a_chercher.length > 0 ? (
              <ul className="space-y-2">
                {angle.sources_visuels_a_chercher.map(
                  (s: ContentAngleSource, i: number) => (
                    <li
                      key={i}
                      className="bg-background/40 border-border rounded-lg border p-3 text-sm"
                    >
                      <p className="text-foreground font-semibold">
                        {s.sujet}{' '}
                        <span className="text-muted-foreground text-xs font-normal">
                          ({s.type} · {s.moment_video})
                        </span>
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {s.instructions}
                      </p>
                      <a
                        href={s.lien_recherche}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary mt-1 inline-block text-xs hover:underline"
                      >
                        Ouvrir la recherche ↗
                      </a>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="✂️ Instructions CapCut">
            {angle.instructions_capcut ? (
              <CopyableBlock
                label="CapCut steps"
                value={angle.instructions_capcut}
              />
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="📱 Caption + hashtags TikTok">
            {angle.caption_tiktok ? (
              <CopyableBlock
                label="Caption"
                value={angle.caption_tiktok}
              />
            ) : (
              <Empty />
            )}
            {angle.hashtags && (
              <CopyableBlock label="Hashtags" value={angle.hashtags} />
            )}
          </Section>

          {/* Actions workflow */}
          <div className="border-border space-y-3 border-t pt-4">
            {message && (
              <p
                className={`text-xs ${
                  message.kind === 'ok' ? 'text-primary' : 'text-destructive'
                }`}
              >
                {message.text}
              </p>
            )}

            {!rejectMode && !publishMode && (
              <div className="flex flex-wrap gap-2">
                {angle.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => void call(() => validateAngle(angle.id))}
                      disabled={busy}
                    >
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectMode(true)}
                      disabled={busy}
                    >
                      Rejeter
                    </Button>
                  </>
                )}
                {(angle.status === 'validated' ||
                  angle.status === 'pending') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void call(() => markAngleProduced(angle.id))
                    }
                    disabled={busy}
                  >
                    Marquer produit
                  </Button>
                )}
                {angle.status !== 'published' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPublishMode(true)}
                    disabled={busy}
                  >
                    Marquer publié
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm('Supprimer cet angle ?'))
                      void call(() => deleteAngle(angle.id));
                  }}
                  disabled={busy}
                >
                  Suppr.
                </Button>
              </div>
            )}

            {rejectMode && (
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Raison du rejet (optionnel)…"
                  rows={2}
                  className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void call(() => rejectAngle(angle.id, rejectReason))
                    }
                    disabled={busy}
                  >
                    Confirmer le rejet
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRejectMode(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {publishMode && (
              <div className="space-y-2">
                <input
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  placeholder="URL TikTok (https://…)"
                  className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
                />
                <input
                  value={insta}
                  onChange={(e) => setInsta(e.target.value)}
                  placeholder="URL Instagram (optionnel)"
                  className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
                />
                <input
                  value={yt}
                  onChange={(e) => setYt(e.target.value)}
                  placeholder="URL YouTube (optionnel)"
                  className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void call(() =>
                        markAnglePublished(angle.id, {
                          tiktok,
                          instagram: insta,
                          youtube: yt,
                        }),
                      )
                    }
                    disabled={busy}
                  >
                    Confirmer publication
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPublishMode(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-foreground mb-2 text-xs font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <p className="text-muted-foreground bg-muted/30 rounded-lg p-3 text-xs italic">
      Non généré.
    </p>
  );
}
