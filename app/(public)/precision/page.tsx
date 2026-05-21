import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getPrecisionScores } from '@/lib/data/precision';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Précision de l’IA Tactuo',
  description:
    'Score de précision des analyses IA Tactuo : vainqueur, score exact, BTTS et Over 2.5 confrontés aux résultats réels.',
};

export const revalidate = 300;

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function pctOrDash(v: number | null): string {
  return v == null ? '—' : `${v}%`;
}

function gradeFromScore(score: number): {
  label: string;
  className: string;
} {
  if (score >= 75)
    return { label: 'Excellent', className: 'text-primary' };
  if (score >= 60)
    return { label: 'Bon', className: 'text-emerald-400' };
  if (score >= 45)
    return { label: 'Correct', className: 'text-amber-300' };
  return { label: 'À surveiller', className: 'text-rose-400' };
}

export default async function PrecisionPage() {
  const supabase = await createClient();
  const { matches, aggregate } = await getPrecisionScores(supabase, 100);
  const grade = gradeFromScore(aggregate.global_score);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Précision de l&apos;IA Tactuo
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          On compare automatiquement chaque prédiction pré-match au résultat
          réel. Aucun cherry-picking : tous les matchs analysés et terminés
          sont comptés. Mise à jour toutes les 5 minutes.
        </p>
      </header>

      {aggregate.total_matches === 0 ? (
        <section className="bg-card border-border rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Pas encore assez de matchs analysés et terminés pour calculer un
            score de précision fiable. Reviens après les premiers résultats.
          </p>
          <Link
            href="/"
            className="text-primary mt-4 inline-block text-sm font-semibold hover:underline"
          >
            Voir les matchs à venir →
          </Link>
        </section>
      ) : (
        <>
          {/* Score global */}
          <section className="bg-card border-border rounded-2xl border p-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Score global de précision
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className={`text-5xl font-bold ${grade.className}`}>
                    {aggregate.global_score}
                    <span className="text-2xl">/100</span>
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${grade.className} border-current/30`}
                  >
                    {grade.label}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  Calculé sur {aggregate.total_matches} matchs terminés avec
                  analyse IA pré-match
                </p>
              </div>
              <div className="text-muted-foreground text-xs sm:text-right">
                Pondération : <br className="hidden sm:block" />
                vainqueur 50 · score exact 30 · BTTS 10 · Over 2.5 10
              </div>
            </div>
          </section>

          {/* Breakdown */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Vainqueur correct"
              value={pctOrDash(aggregate.winner_accuracy)}
              hint="Probabilités IA vs résultat"
            />
            <MetricCard
              label="Score exact"
              value={pctOrDash(aggregate.scoreline_accuracy)}
              hint="Pronostic chiffré au but près"
            />
            <MetricCard
              label="BTTS"
              value={pctOrDash(aggregate.btts_accuracy)}
              hint="Les deux équipes marquent"
            />
            <MetricCard
              label="Over 2.5"
              value={pctOrDash(aggregate.over_2_5_accuracy)}
              hint="Plus de 2 buts au total"
            />
          </section>

          {/* Calibration confidence */}
          <section className="bg-card border-border rounded-2xl border p-5">
            <h2 className="mb-3 text-sm font-semibold">
              Calibration de la confiance
            </h2>
            <p className="text-muted-foreground mb-4 text-xs">
              L&apos;IA annonce un niveau de confiance avant chaque match.
              Voici à quelle fréquence elle a raison sur le vainqueur, par
              niveau.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['high', 'medium', 'low'] as const).map((level) => {
                const c = aggregate.by_confidence[level];
                const labels = {
                  high: 'Confiance élevée',
                  medium: 'Confiance moyenne',
                  low: 'Confiance faible',
                };
                return (
                  <div
                    key={level}
                    className="bg-background/40 border-border rounded-lg border p-3"
                  >
                    <p className="text-muted-foreground text-xs">
                      {labels[level]}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {pctOrDash(c.winner_accuracy)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      sur {c.count} match{c.count > 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Liste des matchs */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Détail match par match
            </h2>
            <ul className="space-y-2">
              {matches.slice(0, 50).map((m) => {
                const ok = m.winner_correct === true;
                const koWinner = m.winner_correct === false;
                const exactOk = m.scoreline_correct === true;
                return (
                  <li key={m.match_id}>
                    <Link
                      href={`/matches/${m.match_id}`}
                      className="bg-card hover:border-primary/40 border-border flex items-center gap-3 rounded-xl border p-3 transition-colors"
                    >
                      <TeamMini name={m.home_name} logo={m.home_logo} />
                      <span className="text-muted-foreground text-xs">vs</span>
                      <TeamMini name={m.away_name} logo={m.away_logo} />
                      <div className="ml-2 text-sm font-mono font-semibold">
                        {m.actual_home}-{m.actual_away}
                      </div>
                      {m.predicted_scoreline && (
                        <div className="text-muted-foreground text-xs">
                          pronostic : {m.predicted_scoreline.home}-
                          {m.predicted_scoreline.away}
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {exactOk && (
                          <span className="bg-primary/15 text-primary border-primary/30 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold">
                            Score exact
                          </span>
                        )}
                        {ok && !exactOk && (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                            Vainqueur ✓
                          </span>
                        )}
                        {koWinner && (
                          <span className="rounded-md border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                            Raté
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs hidden sm:inline">
                          {DATE_FMT.format(new Date(m.kickoff_at))}
                        </span>
                        <span className="font-mono text-sm font-semibold">
                          {m.score}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </div>
  );
}

function TeamMini({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="bg-muted relative size-5 shrink-0 overflow-hidden rounded-full">
        {logo ? (
          <Image
            src={logo}
            alt=""
            fill
            sizes="20px"
            className="object-contain p-0.5"
          />
        ) : null}
      </div>
      <span className="truncate text-sm">{name}</span>
    </div>
  );
}
