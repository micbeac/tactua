import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getAllWCMatches, getWCChampion } from '@/lib/data/world-cup';
import { frTeamName } from '@/lib/national-teams-fr';
import { createClient } from '@/lib/supabase/server';
import { teamHref } from '@/lib/url';

export const metadata: Metadata = {
  title: 'Calendrier et résultats de la Coupe du Monde 2026',
  description:
    'Le calendrier complet de la Coupe du Monde 2026 : dates du match d’ouverture, de la phase de groupes, des phases finales et de la finale du 19 juillet 2026, avec le vainqueur du tournoi.',
  alternates: { canonical: '/coupe-du-monde-2026/calendrier' },
};

export const revalidate = 3600; // 1 h — le calendrier ne bouge plus.

// Dates des phases — calendrier officiel FIFA de la Coupe du Monde 2026.
const PHASES: Array<{ phase: string; dates: string; note: string }> = [
  {
    phase: 'Match d’ouverture',
    dates: '11 juin 2026',
    note: 'Le coup d’envoi du tournoi a été donné à l’Estadio Azteca de Mexico.',
  },
  {
    phase: 'Phase de groupes',
    dates: '11 → 27 juin 2026',
    note: '72 matchs : les 12 groupes de 4 équipes ont disputé leurs trois journées.',
  },
  {
    phase: '16ᵉ de finale',
    dates: '28 juin → 3 juillet 2026',
    note: 'Premier tour à élimination directe, avec 32 équipes qualifiées.',
  },
  {
    phase: '8ᵉ de finale',
    dates: '4 → 7 juillet 2026',
    note: '16 équipes encore en lice.',
  },
  {
    phase: 'Quarts de finale',
    dates: '9 → 11 juillet 2026',
    note: '8 équipes pour 4 places en demi-finale.',
  },
  {
    phase: 'Demi-finales',
    dates: '14 et 15 juillet 2026',
    note: 'Les 4 derniers prétendants au titre.',
  },
  {
    phase: 'Match pour la 3ᵉ place',
    dates: '18 juillet 2026',
    note: 'Les deux perdants des demi-finales se sont affrontés.',
  },
  {
    phase: 'Finale',
    dates: '19 juillet 2026',
    note: 'La finale s’est jouée au MetLife Stadium de New York / New Jersey.',
  },
];

export default async function CalendrierPage() {
  const supabase = await createClient();
  const matches = await getAllWCMatches(supabase);
  const champion = getWCChampion(matches);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-muted-foreground mb-6 text-xs">
        <Link href="/coupe-du-monde-2026" className="hover:text-primary">
          Coupe du Monde 2026
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Calendrier</span>
      </nav>

      <header className="mb-8">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Guide
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Le calendrier de la Coupe du Monde 2026
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          La Coupe du Monde 2026 s’est déroulée du 11 juin au 19 juillet 2026,
          aux États-Unis, au Canada et au Mexique. Voici les dates clés de
          chaque phase du tournoi.
        </p>
      </header>

      {/* Palmarès — dérivé de la finale en base, pas codé en dur. */}
      {champion ? (
        <section className="border-primary/30 bg-primary/5 mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-4">
          {champion.winner.logo_url ? (
            <Image
              src={champion.winner.logo_url}
              alt=""
              width={40}
              height={40}
              className="size-10 object-contain"
            />
          ) : null}
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
              Championne du monde
            </p>
            <Link
              href={teamHref(champion.winner.id, champion.winner.name)}
              className="hover:text-primary text-lg font-semibold"
            >
              {frTeamName(champion.winner.name)}
            </Link>
          </div>
          <p className="text-muted-foreground text-sm">
            Finale du 19 juillet 2026 au MetLife Stadium :{' '}
            {frTeamName(champion.winner.name)} {champion.score}{' '}
            {frTeamName(champion.runner_up.name)}.
          </p>
        </section>
      ) : null}

      <ol className="space-y-3">
        {PHASES.map((p) => (
          <li
            key={p.phase}
            className="bg-card border-border rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-foreground text-base font-semibold">
                {p.phase}
              </h2>
              <p className="text-primary text-sm font-semibold">{p.dates}</p>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{p.note}</p>
          </li>
        ))}
      </ol>

      <section className="bg-primary/5 border-primary/20 mt-8 rounded-xl border p-4 text-sm">
        <p className="text-foreground/90">
          Le détail match par match, avec tous les scores, les classements
          finaux des 12 groupes et le bracket des phases finales, est sur la
          page{' '}
          <Link
            href="/coupe-du-monde-2026"
            className="text-primary font-semibold underline"
          >
            Coupe du Monde 2026
          </Link>{' '}
          — chaque rencontre a sa fiche avec l’analyse IA.
        </p>
      </section>
    </main>
  );
}
