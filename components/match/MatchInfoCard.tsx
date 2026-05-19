export type MatchInfoCardProps = {
  competition_name: string | null;
  competition_country: string | null;
  stage: string | null;
  matchday: number | null;
  venue: string | null;
  referee: string | null;
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
  } = props;
  const items: Array<{ label: string; value: string }> = [];

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
  if (referee) items.push({ label: 'Arbitre', value: referee });

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
          </div>
        ))}
      </dl>
    </section>
  );
}
