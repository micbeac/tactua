'use client';

import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Eye,
  Goal,
  Shield,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { FormationPitch } from '@/components/match/FormationPitch';
import { PlayerPopup, fromSeasonStat } from '@/components/match/PlayerPopup';
import { RichRadarPentagon } from '@/components/match/RichRadarPentagon';
import type {
  DeepPreMatchAnalysis,
  MatchRichData,
  PlayerSeasonStat,
  PreMatchAnalysis,
  RecentFormResult,
} from '@/lib/openai/types';

/**
 * Cherche un joueur dans rich.top_players par nom (fuzzy : ignore casse,
 * accents, initiales abrégées). Retourne le PlayerSeasonStat correspondant
 * pour pouvoir wrapper le nom dans la liste "Joueurs à surveiller" avec un
 * PlayerPopup interactif.
 */
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchTopPlayer(
  topPlayers: PlayerSeasonStat[],
  side: 'home' | 'away',
  rawName: string,
): PlayerSeasonStat | null {
  const target = normalizeName(rawName);
  if (!target) return null;
  const candidates = topPlayers.filter((p) => p.team === side);
  // 1) Match exact
  let found = candidates.find((p) => normalizeName(p.name) === target);
  if (found) return found;
  // 2) L'un contient l'autre (ex : "L. Martinez" vs "Lautaro Martinez")
  found = candidates.find((p) => {
    const n = normalizeName(p.name);
    return n.includes(target) || target.includes(n);
  });
  if (found) return found;
  // 3) Match par dernier mot (nom de famille)
  const targetLast = target.split(' ').pop();
  if (targetLast && targetLast.length >= 3) {
    found = candidates.find((p) => {
      const n = normalizeName(p.name);
      return n.endsWith(targetLast) || n.split(' ').includes(targetLast);
    });
    if (found) return found;
  }
  return null;
}

export type PreMatchAnalysisSectionProps = {
  analysis: PreMatchAnalysis | DeepPreMatchAnalysis | null;
  home_team_name: string;
  away_team_name: string;
  generated_at?: string;
};

function isDeep(
  a: PreMatchAnalysis | DeepPreMatchAnalysis,
): a is DeepPreMatchAnalysis {
  return 'scenarios' in a;
}

function hasRichData(
  a: DeepPreMatchAnalysis,
): a is DeepPreMatchAnalysis & { rich_data: MatchRichData } {
  return Boolean(a.rich_data);
}

const LIKELIHOOD_STYLES: Record<
  'élevée' | 'moyenne' | 'faible',
  { bg: string; text: string; label: string }
> = {
  élevée: {
    bg: 'bg-primary/10 border-primary/30',
    text: 'text-primary',
    label: 'Probabilité élevée',
  },
  moyenne: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-500',
    label: 'Probabilité moyenne',
  },
  faible: {
    bg: 'bg-muted/40 border-border',
    text: 'text-muted-foreground',
    label: 'Probabilité faible',
  },
};

function formColor(r: RecentFormResult): string {
  return r === 'W'
    ? 'bg-primary/20 text-primary'
    : r === 'D'
      ? 'bg-amber-500/20 text-amber-500'
      : 'bg-destructive/20 text-destructive';
}

function ratingColor(r: number | null): string {
  if (r == null) return 'bg-muted/40 text-muted-foreground';
  if (r >= 7.5) return 'bg-primary text-primary-foreground';
  if (r >= 6.8) return 'bg-emerald-500/30 text-emerald-300';
  if (r >= 6.0) return 'bg-amber-500/30 text-amber-300';
  return 'bg-destructive/30 text-destructive';
}

function AIBadge() {
  return (
    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      <Sparkles className="size-3" aria-hidden />
      Analyse IA
    </span>
  );
}

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

// ============================================================================
// SOUS-COMPOSANTS pour les sections rich
// ============================================================================

function RichStatsCompareTable({
  rich,
  home_team_name,
  away_team_name,
}: {
  rich: MatchRichData;
  home_team_name: string;
  away_team_name: string;
}) {
  // Masque la table si toutes les lignes ont home==away (donnees absentes)
  const hasDifferences = rich.stats_compare.some((s) => s.home !== s.away);
  if (!hasDifferences) return null;
  return (
    <div>
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <Activity className="size-3.5" aria-hidden />
        Comparaison statistique
      </div>
      <div className="border-border overflow-hidden rounded-xl border">
        <div className="bg-muted/30 grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2 text-[10px] font-semibold tracking-wide uppercase">
          <span className="text-primary text-right truncate">{home_team_name}</span>
          <span className="text-muted-foreground text-center">Statistique</span>
          <span className="text-primary truncate">{away_team_name}</span>
        </div>
        {rich.stats_compare.map((s) => {
          const homeBest = s.advantage === 'home';
          const awayBest = s.advantage === 'away';
          return (
            <div
              key={s.label}
              className="border-border grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2.5 text-sm last:border-b-0"
            >
              <span
                className={`text-right tabular-nums ${
                  homeBest ? 'text-primary font-semibold' : 'text-foreground/80'
                }`}
              >
                {s.home}
              </span>
              <span className="text-muted-foreground text-center text-xs">
                {s.label}
              </span>
              <span
                className={`tabular-nums ${
                  awayBest ? 'text-primary font-semibold' : 'text-foreground/80'
                }`}
              >
                {s.away}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RichRadarChart({
  rich,
  home_team_name,
  away_team_name,
}: {
  rich: MatchRichData;
  home_team_name: string;
  away_team_name: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <div ref={ref}>
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <BarChart3 className="size-3.5" aria-hidden />
        Comparaison globale
      </div>
      <div className="mb-3 flex items-center justify-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="bg-primary/60 size-3 rounded-sm" />
          <span className="max-w-[120px] truncate">{home_team_name}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-emerald-400 size-3 rounded-sm" />
          <span className="max-w-[120px] truncate">{away_team_name}</span>
        </span>
      </div>
      <div className="border-border bg-muted/20 grid grid-cols-5 items-end gap-3 rounded-xl border p-4">
        {rich.radar.map((cat, i) => (
          <div key={cat.label} className="flex flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end justify-center gap-1.5">
              <div className="relative flex h-full w-3 flex-col justify-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={inView ? { height: `${cat.home}%` } : { height: 0 }}
                  transition={{
                    delay: 0.1 + i * 0.08,
                    duration: 0.8,
                    ease: 'easeOut',
                  }}
                  className="bg-primary/60 w-full rounded-t-sm"
                />
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: 0.9 + i * 0.08, duration: 0.3 }}
                  className="text-foreground/80 absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums"
                  style={{ bottom: `${cat.home}%` }}
                >
                  {cat.home}
                </motion.span>
              </div>
              <div className="relative flex h-full w-3 flex-col justify-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={inView ? { height: `${cat.away}%` } : { height: 0 }}
                  transition={{
                    delay: 0.15 + i * 0.08,
                    duration: 0.8,
                    ease: 'easeOut',
                  }}
                  className="w-full rounded-t-sm bg-emerald-400"
                />
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: 0.95 + i * 0.08, duration: 0.3 }}
                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums text-emerald-300"
                  style={{ bottom: `${cat.away}%` }}
                >
                  {cat.away}
                </motion.span>
              </div>
            </div>
            <span className="text-muted-foreground text-center text-[10px] font-medium">
              {cat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RichForm({
  rich,
  home_team_name,
  away_team_name,
}: {
  rich: MatchRichData;
  home_team_name: string;
  away_team_name: string;
}) {
  const fmtBilan = (form: RecentFormResult[]) => {
    const w = form.filter((r) => r === 'W').length;
    const d = form.filter((r) => r === 'D').length;
    const l = form.filter((r) => r === 'L').length;
    return `${w}V-${d}N-${l}D`;
  };

  return (
    <div>
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <TrendingUp className="size-3.5" aria-hidden />
        Forme récente · 5 derniers
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: home_team_name, form: rich.form_home },
          { name: away_team_name, form: rich.form_away },
        ].map((t) => (
          <div key={t.name} className="border-border rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="truncate text-xs font-semibold">{t.name}</span>
              <span className="text-muted-foreground text-[10px] tabular-nums">
                {fmtBilan(t.form)}
              </span>
            </div>
            <div className="flex gap-1.5">
              {t.form.map((r, ri) => (
                <span
                  key={ri}
                  className={`flex size-7 items-center justify-center rounded-md text-[11px] font-bold ${formColor(r)}`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RichTopPlayers({
  rich,
  home_team_name,
  away_team_name,
}: {
  rich: MatchRichData;
  home_team_name: string;
  away_team_name: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <Star className="size-3.5" aria-hidden />
        Top joueurs saison
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['home', 'away'] as const).map((side) => {
          const players = rich.top_players.filter((p) => p.team === side);
          return (
            <div
              key={side}
              className="border-border bg-muted/20 space-y-2 rounded-lg border p-3"
            >
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase truncate">
                {side === 'home' ? home_team_name : away_team_name}
              </p>
              {players.length === 0 && (
                <p className="text-muted-foreground text-xs italic">
                  Stats indisponibles
                </p>
              )}
              {players.map((p) => (
                <PlayerPopup
                  key={p.name}
                  player={fromSeasonStat(p)}
                  team_name={
                    p.team === 'home' ? home_team_name : away_team_name
                  }
                >
                  <button
                    type="button"
                    className="border-border/60 hover:bg-muted/40 group flex w-full items-center gap-3 border-t py-2 text-left transition-colors first:border-t-0 first:pt-0"
                  >
                    <div className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                      {p.position ?? '–'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                        {p.name}
                        {p.is_captain && (
                          <span className="text-primary ml-1.5 text-[10px] font-bold">
                            (C)
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground truncate text-[11px]">
                        {p.appearances} titu · {p.goals}b/{p.assists}a
                        {p.key_passes != null
                          ? ` · ${p.key_passes} passes clés`
                          : ''}
                      </p>
                    </div>
                    {p.rating != null && (
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums ${ratingColor(p.rating)}`}
                      >
                        {p.rating.toFixed(1)}
                      </div>
                    )}
                  </button>
                </PlayerPopup>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RichAbsents({
  rich,
  home_team_name,
  away_team_name,
}: {
  rich: MatchRichData;
  home_team_name: string;
  away_team_name: string;
}) {
  if (rich.absent_players.length === 0) return null;
  return (
    <div>
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <AlertTriangle className="size-3.5" aria-hidden />
        Indisponibles ({rich.absent_players.length})
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(['home', 'away'] as const).map((side) => {
          const list = rich.absent_players.filter((p) => p.team === side);
          if (list.length === 0) return null;
          return (
            <div
              key={side}
              className="bg-destructive/5 border-destructive/20 rounded-lg border p-3"
            >
              <p className="text-muted-foreground mb-1.5 text-[10px] uppercase truncate">
                {side === 'home' ? home_team_name : away_team_name}
              </p>
              <ul className="space-y-1">
                {list.slice(0, 5).map((p, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-semibold">{p.name}</span>
                    {p.reason && (
                      <span className="text-muted-foreground">
                        {' '}
                        — {p.reason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RichH2HSummary({
  rich,
  home_team_name,
  away_team_name,
}: {
  rich: MatchRichData;
  home_team_name: string;
  away_team_name: string;
}) {
  if (rich.h2h_summary.total === 0) return null;
  const { home_wins, draws, away_wins, total } = rich.h2h_summary;
  return (
    <div>
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <Swords className="size-3.5" aria-hidden />
        Confrontations directes · {total} matchs
      </div>
      <div className="border-border bg-muted/20 grid grid-cols-3 overflow-hidden rounded-lg border">
        <div className="border-border border-r p-3 text-center">
          <p className="text-primary text-2xl font-bold tabular-nums">
            {home_wins}
          </p>
          <p className="text-muted-foreground mt-1 truncate text-[10px] tracking-wide uppercase">
            {home_team_name}
          </p>
        </div>
        <div className="border-border border-r p-3 text-center">
          <p className="text-muted-foreground text-2xl font-bold tabular-nums">
            {draws}
          </p>
          <p className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
            Nuls
          </p>
        </div>
        <div className="p-3 text-center">
          <p className="text-primary text-2xl font-bold tabular-nums">
            {away_wins}
          </p>
          <p className="text-muted-foreground mt-1 truncate text-[10px] tracking-wide uppercase">
            {away_team_name}
          </p>
        </div>
      </div>
    </div>
  );
}

function RichFormations({
  rich,
  home_team_name,
  away_team_name,
}: {
  rich: MatchRichData;
  home_team_name: string;
  away_team_name: string;
}) {
  if (!rich.formation_home && !rich.formation_away) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['home', 'away'] as const).map((side) => {
        const formation =
          side === 'home' ? rich.formation_home : rich.formation_away;
        const teamName = side === 'home' ? home_team_name : away_team_name;
        return (
          <div
            key={side}
            className="border-border bg-muted/20 rounded-lg border p-3"
          >
            <p className="text-muted-foreground mb-1 text-[10px] uppercase truncate">
              {teamName} — formation type
            </p>
            <p className="text-primary text-lg font-bold">
              {formation ?? '—'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function PreMatchAnalysisSection({
  analysis,
  home_team_name,
  away_team_name,
  generated_at,
}: PreMatchAnalysisSectionProps) {
  if (!analysis) {
    return (
      <section className="bg-card border-border rounded-2xl border p-6">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Analyse pré-match</h2>
          <AIBadge />
        </header>
        <p className="text-muted-foreground py-4 text-center text-sm">
          L&apos;analyse sera générée à la sortie de la composition officielle
          (~1h avant le coup d&apos;envoi).
        </p>
      </section>
    );
  }

  const keyHome = analysis.key_players.filter((p) => p.team === 'home');
  const keyAway = analysis.key_players.filter((p) => p.team === 'away');
  const deep = isDeep(analysis);
  const rich = deep && hasRichData(analysis) ? analysis.rich_data : null;
  // Champs enrichis (deep only) — facteur X, duels clés, à surveiller
  const deepAnalysis: DeepPreMatchAnalysis | null = deep ? analysis : null;
  const keyBattles = deepAnalysis?.tactical_overview.key_battles ?? null;
  const legacyKeyBattle = analysis.tactical_overview.key_battle ?? null;
  const xFactor = deepAnalysis?.x_factor ?? null;
  const thingsToWatch = deepAnalysis?.things_to_watch ?? null;

  return (
    <section className="bg-card border-border space-y-7 rounded-2xl border p-6">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Analyse pré-match</h2>
        <div className="flex items-center gap-2">
          {deep && (
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              Mode deep
            </span>
          )}
          <AIBadge />
        </div>
      </header>

      {/* ========================================================== */}
      {/* === 1. VERDICT EN TÊTE (résumé + scénarios + probas) === */}
      {/* ========================================================== */}

      {/* Prédiction synthétique */}
      <div className="border-primary/30 rounded-lg border border-dashed p-4">
        <p className="text-muted-foreground mb-2 text-[10px] tracking-wide uppercase">
          Prédiction
        </p>
        <p className="text-sm">{analysis.prediction.summary}</p>
        <p className="text-primary mt-2 text-sm font-semibold tabular-nums">
          Score plausible : {analysis.prediction.scoreline_guess}
        </p>
      </div>

      {/* Scénarios (IA, deep only) */}
      {deep && analysis.scenarios.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
            Scénarios possibles
          </h3>
          <div className="space-y-3">
            {analysis.scenarios.map((s, i) => {
              const style = LIKELIHOOD_STYLES[s.likelihood];
              return (
                <div key={i} className={`rounded-lg border p-4 ${style.bg}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      Scénario #{i + 1} — {s.title}
                    </p>
                    <span
                      className={`shrink-0 text-[10px] font-semibold tracking-wide uppercase ${style.text}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  <p className="text-sm">{s.narrative}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Probabilités + BTTS + Over + Confiance (IA, deep only) */}
      {deep && (
        <>
          <div>
            <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              <Trophy className="mr-1 inline size-3.5" aria-hidden />
              Probabilités d’issue
            </h3>
            <div className="space-y-2">
              {[
                {
                  label: `${home_team_name} (dom.)`,
                  value: analysis.prediction.probabilities.home_win,
                  color: 'bg-primary',
                },
                {
                  label: 'Match nul',
                  value: analysis.prediction.probabilities.draw,
                  color: 'bg-muted-foreground/60',
                },
                {
                  label: `${away_team_name} (ext.)`,
                  value: analysis.prediction.probabilities.away_win,
                  color: 'bg-primary',
                },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate">{row.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {row.value}%
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={`h-full ${row.color}`}
                      style={{ width: `${row.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] uppercase">
                <Goal className="size-3" aria-hidden />
                Les 2 équipes marquent
              </p>
              <p className="text-sm font-semibold">
                {analysis.prediction.btts === 'yes' ? 'Oui' : 'Non'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {analysis.prediction.btts_reason}
              </p>
            </div>
            <div className="border-border rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] uppercase">
                <TrendingUp className="size-3" aria-hidden />
                Plus de 2.5 buts
              </p>
              <p className="text-sm font-semibold">
                {analysis.prediction.over_2_5 === 'yes' ? 'Oui' : 'Non'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {analysis.prediction.over_2_5_reason}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-medium tracking-wide uppercase">
              <Shield className="size-3.5" aria-hidden />
              Confiance de l’IA
            </h3>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full"
                style={{
                  width:
                    analysis.prediction.confidence === 'high'
                      ? '90%'
                      : analysis.prediction.confidence === 'medium'
                        ? '60%'
                        : '30%',
                }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-right text-xs capitalize">
              {analysis.prediction.confidence === 'high'
                ? 'Élevée'
                : analysis.prediction.confidence === 'medium'
                  ? 'Moyenne'
                  : 'Faible'}
            </p>
          </div>
        </>
      )}

      {/* Ce que disent les chiffres (IA, deep only) */}
      {deep && (
        <div className="bg-muted/40 rounded-lg p-4">
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Ce que disent les chiffres
          </h3>
          <p className="text-sm">{analysis.data_insight}</p>
        </div>
      )}

      {/* === Séparateur visuel avant les stats === */}
      <div className="border-border border-t pt-1">
        <p className="text-muted-foreground/60 -mb-1 text-center text-[10px] tracking-widest uppercase">
          ◆ Données détaillées ◆
        </p>
      </div>

      {/* ============================================ */}
      {/* === 2. STATISTIQUES (calculées, rich) === */}
      {/* ============================================ */}

      {/* Comparaison statistique */}
      {rich && (
        <RichStatsCompareTable
          rich={rich}
          home_team_name={home_team_name}
          away_team_name={away_team_name}
        />
      )}

      {/* Radar comparatif PENTAGONAL — vrai polygone superposé */}
      {rich &&
        rich.radar.length >= 5 &&
        // Masque si les dimensions sont identiques pour les 2 equipes
        // (signe que les stats sources ne sont pas disponibles -> fallback
        // identique qui donne un radar superpose sans info)
        rich.radar.some((d) => d.home !== d.away) && (
          <div>
            <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <BarChart3 className="size-3.5" aria-hidden />
              Comparaison globale
            </div>
            <div className="bg-muted/20 border-border rounded-xl border p-4">
              <RichRadarPentagon
                dimensions={rich.radar}
                home_team_name={home_team_name}
                away_team_name={away_team_name}
              />
            </div>
          </div>
        )}

      {/* Forme récente */}
      {rich && (
        <RichForm
          rich={rich}
          home_team_name={home_team_name}
          away_team_name={away_team_name}
        />
      )}

      {/* H2H summary */}
      {rich && (
        <RichH2HSummary
          rich={rich}
          home_team_name={home_team_name}
          away_team_name={away_team_name}
        />
      )}

      {/* Formations type — mini-terrains côte à côte */}
      {rich && (rich.formation_home || rich.formation_away) && (
        <div>
          <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <Users className="size-3.5" aria-hidden />
            Formations type
          </div>
          <div className="flex flex-wrap items-start justify-center gap-4">
            <FormationPitch
              formation={rich.formation_home}
              team_name={home_team_name}
              variant="primary"
            />
            <FormationPitch
              formation={rich.formation_away}
              team_name={away_team_name}
              variant="emerald"
            />
          </div>
        </div>
      )}

      {/* Top joueurs détaillés */}
      {rich && (
        <RichTopPlayers
          rich={rich}
          home_team_name={home_team_name}
          away_team_name={away_team_name}
        />
      )}

      {/* Indisponibles */}
      {rich && (
        <RichAbsents
          rich={rich}
          home_team_name={home_team_name}
          away_team_name={away_team_name}
        />
      )}

      {/* ========================================================= */}
      {/* === 3. NARRATIFS IA (tactique, forme, joueurs, faib.) === */}
      {/* ========================================================= */}

      {/* Tactique */}
      <div>
        <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Tactique
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-muted-foreground mb-1 text-[10px] uppercase truncate">
              {home_team_name} (dom.)
            </p>
            <p className="text-sm">{analysis.tactical_overview.home_approach}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-muted-foreground mb-1 text-[10px] uppercase truncate">
              {away_team_name} (ext.)
            </p>
            <p className="text-sm">{analysis.tactical_overview.away_approach}</p>
          </div>
        </div>
        {keyBattles && keyBattles.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              Duels clés
            </p>
            {keyBattles.map((b, i) => (
              <p key={i} className="text-sm">
                <span className="text-primary font-semibold">
                  {b.title}
                  {' — '}
                </span>
                {b.detail}
              </p>
            ))}
          </div>
        ) : legacyKeyBattle ? (
          <p className="text-foreground mt-3 text-sm">
            <span className="text-primary font-semibold">Duel clé : </span>
            {legacyKeyBattle}
          </p>
        ) : null}
      </div>

      {/* Le facteur X (IA, deep only) */}
      {xFactor && (
        <div className="bg-primary/5 border-primary/20 rounded-lg border p-4">
          <h3 className="text-primary mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="size-3.5" aria-hidden />
            Le facteur X
          </h3>
          <p className="text-foreground text-sm font-semibold">
            {xFactor.title}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {xFactor.detail}
          </p>
        </div>
      )}

      {/* Lecture de la forme */}
      <div>
        <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Lecture de la forme
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground mb-1 text-[10px] uppercase truncate">
              {home_team_name}
            </p>
            <p className="text-sm">{analysis.form_assessment.home_form}</p>
          </div>
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground mb-1 text-[10px] uppercase truncate">
              {away_team_name}
            </p>
            <p className="text-sm">{analysis.form_assessment.away_form}</p>
          </div>
        </div>
      </div>

      {/* Joueurs à surveiller (IA) — cliquable si match avec rich.top_players */}
      {analysis.key_players.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            <Users className="mr-1 inline size-3.5" aria-hidden />
            Joueurs à surveiller
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: home_team_name, list: keyHome, side: 'home' as const },
              { label: away_team_name, list: keyAway, side: 'away' as const },
            ].map(({ label, list, side }) =>
              list.length > 0 ? (
                <div key={label}>
                  <p className="text-muted-foreground mb-2 text-[10px] uppercase truncate">
                    {label}
                  </p>
                  <ul className="space-y-2">
                    {list.map((p) => {
                      // Cherche le joueur dans rich.top_players par nom (fuzzy)
                      const matched = rich
                        ? matchTopPlayer(rich.top_players, side, p.name)
                        : null;
                      const teamName =
                        side === 'home' ? home_team_name : away_team_name;
                      return (
                        <li key={p.name} className="text-sm">
                          {matched ? (
                            <PlayerPopup
                              player={fromSeasonStat(matched)}
                              team_name={teamName}
                            >
                              <span className="text-primary font-semibold hover:underline">
                                {p.name}
                              </span>
                            </PlayerPopup>
                          ) : (
                            <span className="text-primary font-semibold">
                              {p.name}
                            </span>
                          )}{' '}
                          — {p.why}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Points faibles */}
      <div>
        <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Points faibles
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
            <p className="text-muted-foreground mb-1 text-[10px] uppercase truncate">
              {home_team_name}
            </p>
            <p className="text-sm">{analysis.weak_points.home}</p>
          </div>
          <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
            <p className="text-muted-foreground mb-1 text-[10px] uppercase truncate">
              {away_team_name}
            </p>
            <p className="text-sm">{analysis.weak_points.away}</p>
          </div>
        </div>
      </div>

      {/* À surveiller (IA, deep only) */}
      {thingsToWatch && thingsToWatch.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <Eye className="size-3.5" aria-hidden />
            À surveiller pendant le match
          </h3>
          <ul className="space-y-1.5">
            {thingsToWatch.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-primary shrink-0 font-bold">
                  {i + 1}.
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {generated_at && (
        <p className="text-muted-foreground/70 text-right text-[10px]">
          Générée le {DATE_FMT.format(new Date(generated_at))} · GPT-4o-mini
        </p>
      )}
    </section>
  );
}
