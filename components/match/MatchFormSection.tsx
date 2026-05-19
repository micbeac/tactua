import Link from 'next/link';

export type FormItem = {
  id: number;
  result: 'W' | 'D' | 'L';
  score_for: number | null;
  score_against: number | null;
  was_home: boolean;
};

export type TeamForm = {
  team_id: number | null;
  team_name: string;
  matches: FormItem[];
};

export type MatchFormSectionProps = {
  home: TeamForm;
  away: TeamForm;
};

function ResultPill({ item }: { item: FormItem }) {
  const cfg = {
    W: 'bg-primary text-primary-foreground',
    D: 'bg-muted text-muted-foreground',
    L: 'bg-destructive/20 text-destructive',
  }[item.result];
  const label = `${item.result} ${item.score_for ?? 0}-${item.score_against ?? 0} ${
    item.was_home ? 'dom.' : 'ext.'
  }`;
  return (
    <Link
      href={`/matches/${item.id}`}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-opacity hover:opacity-80 ${cfg}`}
      title={label}
      aria-label={label}
    >
      {item.result}
    </Link>
  );
}

function TeamFormBlock({
  form,
  align,
}: {
  form: TeamForm;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`flex flex-col gap-2 ${align === 'right' ? 'sm:items-end' : 'sm:items-start'}`}
    >
      <p
        className={`text-sm font-medium ${align === 'right' ? 'sm:text-right' : 'sm:text-left'}`}
      >
        {form.team_name || '—'}
      </p>
      {form.matches.length === 0 ? (
        <p className="text-muted-foreground text-xs italic">
          Aucun match récent enregistré.
        </p>
      ) : (
        <div
          className={`flex items-center gap-1.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}
        >
          {form.matches.map((m) => (
            <ResultPill key={m.id} item={m} />
          ))}
          <span className="text-muted-foreground ml-1 text-[10px] tracking-wide uppercase">
            {align === 'right' ? '← récent' : 'récent →'}
          </span>
        </div>
      )}
    </div>
  );
}

export function MatchFormSection({ home, away }: MatchFormSectionProps) {
  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <h2 className="mb-4 text-base font-semibold">Forme récente</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <TeamFormBlock form={home} align="left" />
        <TeamFormBlock form={away} align="right" />
      </div>
    </section>
  );
}
