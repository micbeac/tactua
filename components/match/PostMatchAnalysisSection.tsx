import { Sparkles, Trophy } from 'lucide-react';
import type { PostMatchAnalysis } from '@/lib/openai/types';

export type PostMatchAnalysisSectionProps = {
  analysis: PostMatchAnalysis | null;
  home_team_name: string;
  away_team_name: string;
  generated_at?: string;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

function AIBadge() {
  return (
    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      <Sparkles className="size-3" aria-hidden />
      Analyse IA
    </span>
  );
}

function teamLabel(side: 'home' | 'away', home: string, away: string): string {
  return side === 'home' ? home : away;
}

export function PostMatchAnalysisSection({
  analysis,
  home_team_name,
  away_team_name,
  generated_at,
}: PostMatchAnalysisSectionProps) {
  if (!analysis) {
    return (
      <section className="bg-card border-border rounded-2xl border p-6">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Analyse post-match</h2>
          <AIBadge />
        </header>
        <p className="text-muted-foreground py-4 text-center text-sm">
          L&apos;analyse post-match est en cours de génération.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold">Analyse post-match</h2>
        <AIBadge />
      </header>

      <div className="space-y-6">
        {analysis.facts.length > 0 && (
          <div>
            <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Faits marquants
            </h3>
            <ul className="space-y-1.5">
              {analysis.facts.map((f, i) => (
                <li key={i} className="text-sm">
                  <span className="text-primary mr-2">▸</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-primary/5 border-primary/20 rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="text-primary size-4" aria-hidden />
            <h3 className="text-xs font-semibold tracking-wide uppercase">
              Homme du match
            </h3>
          </div>
          <p className="text-lg font-semibold">
            {analysis.man_of_the_match.name}
          </p>
          <p className="text-muted-foreground text-xs">
            {teamLabel(
              analysis.man_of_the_match.team,
              home_team_name,
              away_team_name,
            )}
          </p>
          <p className="mt-2 text-sm">{analysis.man_of_the_match.why}</p>
        </div>

        {analysis.notable_performances.length > 0 && (
          <div>
            <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Performances notables
            </h3>
            <ul className="space-y-2">
              {analysis.notable_performances.map((p, i) => (
                <li key={i} className="text-sm">
                  <span className="text-primary font-semibold">{p.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {' '}
                    · {teamLabel(p.team, home_team_name, away_team_name)}
                  </span>
                  <span className="block sm:inline"> — {p.why}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Lecture tactique
          </h3>
          <p className="text-sm">{analysis.tactical_reading}</p>
        </div>

        <div className="border-l-primary/40 border-l-2 pl-4">
          <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
            Moment-clé
          </h3>
          <p className="text-sm italic">{analysis.turning_point}</p>
        </div>
      </div>

      {generated_at && (
        <p className="text-muted-foreground/70 mt-5 text-right text-[10px]">
          Générée le {DATE_FMT.format(new Date(generated_at))}
        </p>
      )}
    </section>
  );
}
