import Image from 'next/image';
import Link from 'next/link';

export type StandingTeam = {
  team_id: number;
  position: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_difference: number | null;
  points: number | null;
  team_name: string;
  team_logo: string | null;
  team_tla: string | null;
};

export type TeamStandingMiniProps = {
  competition_name: string;
  highlight_team_id: number;
  rows: StandingTeam[];
};

export function TeamStandingMini({
  competition_name,
  highlight_team_id,
  rows,
}: TeamStandingMiniProps) {
  if (rows.length === 0) return null;
  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <h2 className="mb-4 text-base font-semibold">
        Classement{' '}
        <span className="text-muted-foreground font-normal">
          · {competition_name}
        </span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left text-[10px] tracking-wide uppercase">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Équipe</th>
              <th className="px-1 py-2 text-center font-medium">J</th>
              <th className="px-1 py-2 text-center font-medium">V</th>
              <th className="px-1 py-2 text-center font-medium">N</th>
              <th className="px-1 py-2 text-center font-medium">D</th>
              <th className="px-1 py-2 text-center font-medium">Diff.</th>
              <th className="py-2 pl-1 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isHighlight = r.team_id === highlight_team_id;
              return (
                <tr
                  key={r.team_id}
                  className={`border-border/60 border-b last:border-b-0 ${
                    isHighlight ? 'bg-primary/5' : ''
                  }`}
                >
                  <td
                    className={`py-2 pr-2 tabular-nums ${
                      isHighlight
                        ? 'text-primary font-semibold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {r.position ?? '—'}
                  </td>
                  <td className="py-2 pr-2">
                    <Link
                      href={`/teams/${r.team_id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <span className="bg-muted relative size-5 shrink-0 overflow-hidden rounded-full">
                        {r.team_logo ? (
                          <Image
                            src={r.team_logo}
                            alt=""
                            fill
                            sizes="20px"
                            className="object-contain p-0.5"
                          />
                        ) : null}
                      </span>
                      <span
                        className={`truncate ${isHighlight ? 'font-semibold' : ''}`}
                      >
                        {r.team_name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-1 py-2 text-center tabular-nums">
                    {r.played ?? '—'}
                  </td>
                  <td className="px-1 py-2 text-center tabular-nums">
                    {r.wins ?? '—'}
                  </td>
                  <td className="px-1 py-2 text-center tabular-nums">
                    {r.draws ?? '—'}
                  </td>
                  <td className="px-1 py-2 text-center tabular-nums">
                    {r.losses ?? '—'}
                  </td>
                  <td className="text-muted-foreground px-1 py-2 text-center tabular-nums">
                    {r.goal_difference != null
                      ? r.goal_difference > 0
                        ? `+${r.goal_difference}`
                        : r.goal_difference
                      : '—'}
                  </td>
                  <td className="py-2 pl-1 text-right font-semibold tabular-nums">
                    {r.points ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
