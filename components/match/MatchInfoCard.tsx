export type MatchInfoCardProps = {
  competition_name: string | null;
  competition_country: string | null;
  stage: string | null;
  matchday: number | null;
  venue: string | null;
  referee: string | null;
  /** Profil disciplinaire de l'arbitre (cartons/match), si disponible */
  referee_profile?: {
    matches: number;
    yellow_per_match: number;
    red_per_match: number;
  } | null;
};

function formatStage(stage: string | null): string | null {
  if (!stage) return null;
  return stage
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MatchInfoCard(props: MatchInfoCardProps) {
  const {
    competition_name,
    competition_country,
    stage,
    matchday,
    venue,
    referee,
    referee_profile,
  } = props;
  const items: Array<{ label: string; value: string; hint?: string }> = [];

  if (competition_name) {
    items.push({
      label: 'Compétition',
      value: competition_country
        ? `${competition_name} (${competition_country})`
        : competition_name,
    });
  }
  const stageLabel = formatStage(stage);
  if (stageLabel)
    items.push({ label: 'Stade de la compétition', value: stageLabel });
  if (matchday != null)
    items.push({ label: 'Journée', value: String(matchday) });
  if (venue) items.push({ label: 'Stade', value: venue });
  if (referee) {
    let hint: string | undefined;
    if (referee_profile) {
      const rp = referee_profile;
      const red =
        rp.red_per_match >= 0.1
          ? ` · ${rp.red_per_match.toFixed(2)} rouge/match`
          : '';
      hint = `${rp.yellow_per_match} cartons jaunes/match${red} (sur ${rp.matches} matchs)`;
    }
    items.push({ label: 'Arbitre', value: referee, hint });
  }

  if (items.length === 0) return null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <h2 className="mb-4 text-base font-semibold">Informations</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              {it.label}
            </dt>
            <dd className="text-foreground mt-0.5 text-sm">{it.value}</dd>
            {it.hint && (
              <dd className="text-muted-foreground mt-0.5 text-xs">
                {it.hint}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
