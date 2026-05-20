import { Sparkles } from 'lucide-react';
import type {
  DeepPreMatchAnalysis,
  PreMatchAnalysis,
} from '@/lib/openai/types';

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
    text: 'text-amber-600',
    label: 'Probabilité moyenne',
  },
  faible: {
    bg: 'bg-muted/40 border-border',
    text: 'text-muted-foreground',
    label: 'Probabilité faible',
  },
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function AIBadge() {
  return (
    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      <Sparkles className="size-3" aria-hidden />
      Analyse IA
    </span>
  );
}

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

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold">Analyse pré-match</h2>
        <AIBadge />
      </header>

      <div className="space-y-6">
        <div>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Tactique
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-muted-foreground mb-1 text-[10px] uppercase">
                {home_team_name} (dom.)
              </p>
              <p className="text-sm">
                {analysis.tactical_overview.home_approach}
              </p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-muted-foreground mb-1 text-[10px] uppercase">
                {away_team_name} (ext.)
              </p>
              <p className="text-sm">
                {analysis.tactical_overview.away_approach}
              </p>
            </div>
          </div>
          <p className="text-foreground mt-3 text-sm">
            <span className="text-primary font-semibold">Duel clé : </span>
            {analysis.tactical_overview.key_battle}
          </p>
        </div>

        <div>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Forme récente
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 text-[10px] uppercase">
                {home_team_name}
              </p>
              <p className="text-sm">{analysis.form_assessment.home_form}</p>
            </div>
            <div className="border-border rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 text-[10px] uppercase">
                {away_team_name}
              </p>
              <p className="text-sm">{analysis.form_assessment.away_form}</p>
            </div>
          </div>
        </div>

        {analysis.key_players.length > 0 && (
          <div>
            <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Joueurs clés
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: home_team_name, list: keyHome },
                { label: away_team_name, list: keyAway },
              ].map(({ label, list }) =>
                list.length > 0 ? (
                  <div key={label}>
                    <p className="text-muted-foreground mb-2 text-[10px] uppercase">
                      {label}
                    </p>
                    <ul className="space-y-2">
                      {list.map((p) => (
                        <li key={p.name} className="text-sm">
                          <span className="text-primary font-semibold">
                            {p.name}
                          </span>{' '}
                          — {p.why}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Points faibles
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-destructive/5 rounded-lg p-3">
              <p className="text-muted-foreground mb-1 text-[10px] uppercase">
                {home_team_name}
              </p>
              <p className="text-sm">{analysis.weak_points.home}</p>
            </div>
            <div className="bg-destructive/5 rounded-lg p-3">
              <p className="text-muted-foreground mb-1 text-[10px] uppercase">
                {away_team_name}
              </p>
              <p className="text-sm">{analysis.weak_points.away}</p>
            </div>
          </div>
        </div>

        {isDeep(analysis) && (
          <>
            <div className="bg-muted/40 rounded-lg p-4">
              <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Ce que disent les chiffres
              </h3>
              <p className="text-sm">{analysis.data_insight}</p>
            </div>

            {analysis.scenarios.length > 0 && (
              <div>
                <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                  Scénarios possibles
                </h3>
                <div className="space-y-3">
                  {analysis.scenarios.map((s, i) => {
                    const style = LIKELIHOOD_STYLES[s.likelihood];
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border p-4 ${style.bg}`}
                      >
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
          </>
        )}

        <div className="border-primary/30 rounded-lg border border-dashed p-4">
          <p className="text-muted-foreground mb-2 text-[10px] tracking-wide uppercase">
            Prédiction
          </p>
          <p className="text-sm">{analysis.prediction.summary}</p>
          <p className="text-primary mt-2 text-sm font-semibold tabular-nums">
            Score plausible : {analysis.prediction.scoreline_guess}
          </p>
        </div>

        {isDeep(analysis) && (
          <>
            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Probabilités
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
                      <span>{row.label}</span>
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
                <p className="text-muted-foreground mb-1 text-[10px] uppercase">
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
                <p className="text-muted-foreground mb-1 text-[10px] uppercase">
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
              <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
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
      </div>

      {generated_at && (
        <p className="text-muted-foreground/70 mt-5 text-right text-[10px]">
          Générée le {DATE_FMT.format(new Date(generated_at))}
        </p>
      )}
    </section>
  );
}
