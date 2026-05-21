'use client';

import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  FlaskConical,
  Loader2,
  Minus,
  RefreshCw,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import type {
  DeepPreMatchAnalysis,
  PlayerSeasonStat,
} from '@/lib/openai/types';

export type WhatIfSimulatorProps = {
  match_id: number;
  /** Analyse canonique (pour la comparaison) */
  original_analysis: DeepPreMatchAnalysis;
  home_team_name: string;
  away_team_name: string;
};

function diffArrow(diff: number, accent?: boolean) {
  if (Math.abs(diff) < 0.5) return <Minus className="size-3" aria-hidden />;
  if (diff > 0)
    return (
      <ArrowUp
        className={`size-3 ${accent ? 'text-primary' : 'text-emerald-400'}`}
        aria-hidden
      />
    );
  return (
    <ArrowDown
      className={`size-3 ${accent ? 'text-destructive' : 'text-amber-400'}`}
      aria-hidden
    />
  );
}

export function WhatIfSimulator({
  match_id,
  original_analysis,
  home_team_name,
  away_team_name,
}: WhatIfSimulatorProps) {
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState<DeepPreMatchAnalysis | null>(null);

  const topPlayers = original_analysis.rich_data?.top_players ?? [];
  // On ne propose que les joueurs liés à un id DB (les autres ne sont pas exclusibles)
  const eligible = topPlayers.filter((p) => p.db_player_id != null);

  function toggle(playerId: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function runSimulation() {
    if (excluded.size === 0) {
      setError('Sélectionne au moins 1 joueur à exclure');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${match_id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pre_match',
          excluded_player_ids: Array.from(excluded),
          save: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.message ? ` — ${data.message}` : '';
        throw new Error(
          `${data?.error ?? 'Erreur lors de la simulation'}${detail}`,
        );
      }
      setWhatIf(data.analysis as DeepPreMatchAnalysis);
      track('What-if lancé', { excluded_count: excluded.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setExcluded(new Set());
    setWhatIf(null);
    setError(null);
  }

  // Différentiel probabilités
  const original = original_analysis.prediction;
  const wi = whatIf?.prediction;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={eligible.length === 0}
        className="gap-1.5"
      >
        <FlaskConical className="size-3.5" aria-hidden />
        Simuler une absence
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="bg-card border-border max-w-2xl border sm:max-w-2xl">
          <DialogTitle className="mb-1 flex items-center gap-2 text-base font-semibold">
            <FlaskConical className="text-primary size-4" aria-hidden />
            What-if simulator
          </DialogTitle>
          <p className="text-muted-foreground mb-4 text-xs">
            Marque un ou plusieurs joueurs clés comme absents et l&apos;IA
            recalcule prédictions et scénarios. L&apos;analyse canonique du
            match n&apos;est pas écrasée.
          </p>

          {!whatIf && (
            <>
              {/* Liste des joueurs cliquables */}
              <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                {eligible.length === 0 ? (
                  <p className="text-muted-foreground text-center text-xs italic">
                    Pas de joueurs détaillés disponibles pour cette analyse.
                  </p>
                ) : (
                  eligible.map((p) => {
                    const teamName =
                      p.team === 'home' ? home_team_name : away_team_name;
                    const isExcl = excluded.has(p.db_player_id!);
                    return (
                      <button
                        key={p.db_player_id}
                        type="button"
                        onClick={() => toggle(p.db_player_id!)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                          isExcl
                            ? 'bg-destructive/5 border-destructive/30'
                            : 'bg-card border-border hover:border-primary/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isExcl}
                          onChange={() => {}}
                          className="accent-destructive size-4 shrink-0"
                        />
                        <PlayerThumb p={p} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {p.name}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            {p.position ?? '—'} · {teamName} · {p.goals}b/
                            {p.assists}a
                          </p>
                        </div>
                        {isExcl && (
                          <span className="bg-destructive/15 text-destructive rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                            Absent
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {error && (
                <p className="text-destructive mt-3 text-xs">{error}</p>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={loading || excluded.size === 0}
                >
                  Réinitialiser
                </Button>
                <Button
                  size="sm"
                  onClick={runSimulation}
                  disabled={loading || excluded.size === 0}
                >
                  {loading ? (
                    <Loader2
                      className="mr-1.5 size-3.5 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                  )}
                  Simuler ({excluded.size})
                </Button>
              </div>
            </>
          )}

          {whatIf && wi && (
            <ComparisonView
              original={original}
              whatIf={wi}
              whatIfAnalysis={whatIf}
              home_team_name={home_team_name}
              away_team_name={away_team_name}
              excluded_count={excluded.size}
              onReset={reset}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlayerThumb({ p }: { p: PlayerSeasonStat }) {
  return (
    <div className="bg-muted relative size-9 shrink-0 overflow-hidden rounded-full">
      {p.photo ? (
        <Image
          src={p.photo}
          alt=""
          fill
          sizes="36px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-bold">
          {p.name.charAt(0)}
        </span>
      )}
    </div>
  );
}

function ComparisonView({
  original,
  whatIf,
  whatIfAnalysis,
  home_team_name,
  away_team_name,
  excluded_count,
  onReset,
}: {
  original: DeepPreMatchAnalysis['prediction'];
  whatIf: DeepPreMatchAnalysis['prediction'];
  whatIfAnalysis: DeepPreMatchAnalysis;
  home_team_name: string;
  away_team_name: string;
  excluded_count: number;
  onReset: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      <div className="bg-primary/10 border-primary/30 rounded-lg border p-3 text-sm">
        <p className="font-semibold">
          Simulation avec {excluded_count} absent
          {excluded_count > 1 ? 's' : ''} 🧪
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          L&apos;IA a régénéré la prédiction avec ces joueurs marqués absents.
          Comparaison avec l&apos;analyse originale :
        </p>
      </div>

      {/* Probabilités côte-à-côte */}
      <div>
        <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
          Probabilités 1X2
        </p>
        <div className="space-y-2">
          {[
            {
              label: `${home_team_name} (dom.)`,
              orig: original.probabilities.home_win,
              wi: whatIf.probabilities.home_win,
            },
            {
              label: 'Match nul',
              orig: original.probabilities.draw,
              wi: whatIf.probabilities.draw,
            },
            {
              label: `${away_team_name} (ext.)`,
              orig: original.probabilities.away_win,
              wi: whatIf.probabilities.away_win,
            },
          ].map((row) => {
            const diff = row.wi - row.orig;
            return (
              <div
                key={row.label}
                className="border-border bg-card rounded-lg border px-3 py-2"
              >
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{row.label}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    <span className="text-muted-foreground">
                      {row.orig}%
                    </span>
                    <span aria-hidden>→</span>
                    <span
                      className={`font-bold ${
                        Math.abs(diff) >= 5
                          ? diff > 0
                            ? 'text-primary'
                            : 'text-destructive'
                          : 'text-foreground'
                      }`}
                    >
                      {row.wi}%
                    </span>
                    {diffArrow(diff)}
                    <span
                      className={`text-[10px] font-bold ${
                        diff > 0
                          ? 'text-primary'
                          : diff < 0
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff}pp
                    </span>
                  </span>
                </div>
                <div className="bg-muted relative h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-muted-foreground/40 absolute top-0 h-full"
                    style={{ width: `${row.orig}%` }}
                  />
                  <div
                    className="bg-primary/70 absolute top-0 h-full"
                    style={{ width: `${row.wi}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground/70 mt-2 text-[10px]">
          Barre grise = original · Barre verte = simulation
        </p>
      </div>

      {/* Score plausible + confiance */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border-border rounded-lg border p-3">
          <p className="text-muted-foreground mb-1 text-[10px] tracking-wide uppercase">
            Score plausible
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">
              {original.scoreline_guess}
            </span>
            <span className="mx-2" aria-hidden>
              →
            </span>
            <span className="text-primary font-bold tabular-nums">
              {whatIf.scoreline_guess}
            </span>
          </p>
        </div>
        <div className="border-border rounded-lg border p-3">
          <p className="text-muted-foreground mb-1 text-[10px] tracking-wide uppercase">
            Confiance
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground capitalize">
              {original.confidence}
            </span>
            <span className="mx-2" aria-hidden>
              →
            </span>
            <span className="text-primary font-bold capitalize">
              {whatIf.confidence}
            </span>
          </p>
        </div>
      </div>

      {/* Nouveaux scénarios */}
      {whatIfAnalysis.scenarios.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
            Nouveaux scénarios
          </p>
          <ol className="space-y-2">
            {whatIfAnalysis.scenarios.map((s, i) => (
              <li
                key={i}
                className="border-border bg-muted/30 rounded-lg border p-2.5 text-xs"
              >
                <p className="font-semibold">
                  #{i + 1} — {s.title}
                </p>
                <p className="text-muted-foreground mt-1 leading-snug">
                  {s.narrative}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onReset}>
          Nouvelle simulation
        </Button>
      </div>
    </motion.div>
  );
}
