import Image from 'next/image';
import Link from 'next/link';
import { playerHref } from '@/lib/url';

export type SquadPlayer = {
  id: number;
  name: string;
  position: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  photo_url: string | null;
  shirt_number: number | null;
};

export type TeamSquadSectionProps = {
  players: SquadPlayer[];
};

type Category = 'Gardiens' | 'Défenseurs' | 'Milieux' | 'Attaquants' | 'Autres';

const ORDER: Category[] = [
  'Gardiens',
  'Défenseurs',
  'Milieux',
  'Attaquants',
  'Autres',
];

function categorize(position: string | null): Category {
  if (!position) return 'Autres';
  const p = position.toLowerCase();
  if (p.includes('keeper') || p === 'goalkeeper') return 'Gardiens';
  if (
    p.includes('back') ||
    p.includes('defender') ||
    p === 'centre-back' ||
    p === 'sweeper'
  )
    return 'Défenseurs';
  if (p.includes('midfield')) return 'Milieux';
  if (
    p.includes('forward') ||
    p.includes('winger') ||
    p.includes('striker') ||
    p.includes('attack')
  )
    return 'Attaquants';
  return 'Autres';
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function TeamSquadSection({ players }: TeamSquadSectionProps) {
  const groups = new Map<Category, SquadPlayer[]>();
  for (const p of players) {
    const cat = categorize(p.position);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Effectif</h2>
        {players.length > 0 && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {players.length} joueurs
          </p>
        )}
      </header>

      {players.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          L&apos;effectif de cette équipe n&apos;est pas encore enregistré.
        </p>
      ) : (
        <div className="space-y-6">
          {ORDER.filter((c) => groups.has(c)).map((cat) => {
            const list = groups.get(cat)!;
            return (
              <div key={cat}>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  {cat}
                  <span className="text-muted-foreground/60 ml-1.5 font-normal">
                    ({list.length})
                  </span>
                </p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {list.map((p) => {
                    const age = computeAge(p.date_of_birth);
                    return (
                      <li key={p.id}>
                        <Link
                          href={playerHref(p.id, p.name)}
                          className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
                        >
                          <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-full">
                            {p.photo_url ? (
                              <Image
                                src={p.photo_url}
                                alt=""
                                fill
                                sizes="32px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <span className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-semibold">
                                {p.shirt_number ?? p.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="flex-1 truncate text-sm font-medium">
                            {p.shirt_number != null && (
                              <span className="text-muted-foreground mr-2 tabular-nums">
                                {p.shirt_number}
                              </span>
                            )}
                            {p.name}
                          </span>
                          <span className="text-muted-foreground hidden text-xs sm:inline">
                            {[p.position, age != null ? `${age} a.` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
