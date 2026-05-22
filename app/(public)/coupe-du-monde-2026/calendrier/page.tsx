import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Calendrier de la Coupe du Monde 2026 : dates clés',
  description:
    'Le calendrier de la Coupe du Monde 2026 : dates du match d’ouverture, de la phase de groupes, des phases finales et de la finale du 19 juillet 2026.',
  alternates: { canonical: '/coupe-du-monde-2026/calendrier' },
};

// Dates des phases — calendrier officiel FIFA de la Coupe du Monde 2026.
const PHASES: Array<{ phase: string; dates: string; note: string }> = [
  {
    phase: 'Match d’ouverture',
    dates: '11 juin 2026',
    note: 'Le coup d’envoi du tournoi est donné à l’Estadio Azteca de Mexico.',
  },
  {
    phase: 'Phase de groupes',
    dates: '11 → 27 juin 2026',
    note: '72 matchs : les 12 groupes de 4 équipes disputent leurs trois journées.',
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
    note: 'Les deux perdants des demi-finales s’affrontent.',
  },
  {
    phase: 'Finale',
    dates: '19 juillet 2026',
    note: 'La finale se joue au MetLife Stadium de New York / New Jersey.',
  },
];

export default function CalendrierPage() {
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
          La Coupe du Monde 2026 se déroule du 11 juin au 19 juillet 2026. Voici
          les dates clés de chaque phase du tournoi.
        </p>
      </header>

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
          Le calendrier match par match, jour par jour, est disponible sur la
          page{' '}
          <Link
            href="/coupe-du-monde-2026"
            className="text-primary font-semibold underline"
          >
            Coupe du Monde 2026
          </Link>{' '}
          — avec les scores en direct et les pronostics IA.
        </p>
      </section>
    </main>
  );
}
