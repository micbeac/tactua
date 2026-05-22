import type { Metadata } from 'next';
import Link from 'next/link';
import { WC_HOST_CITIES, type HostCity } from '@/lib/content/world-cup';

export const metadata: Metadata = {
  title: 'Villes hôtes de la Coupe du Monde 2026 : 16 villes, 3 pays',
  description:
    'Les 16 villes hôtes de la Coupe du Monde 2026 et leurs stades, réparties entre les États-Unis, le Canada et le Mexique.',
  alternates: { canonical: '/coupe-du-monde-2026/villes-hotes' },
};

const COUNTRIES: Array<HostCity['country']> = [
  'États-Unis',
  'Canada',
  'Mexique',
];

const FLAG: Record<HostCity['country'], string> = {
  'États-Unis': '🇺🇸',
  Canada: '🇨🇦',
  Mexique: '🇲🇽',
};

export default function VillesHotesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-muted-foreground mb-6 text-xs">
        <Link href="/coupe-du-monde-2026" className="hover:text-primary">
          Coupe du Monde 2026
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Villes hôtes</span>
      </nav>

      <header className="mb-8">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Guide
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Les villes hôtes de la Coupe du Monde 2026
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          La Coupe du Monde 2026 se joue dans 16 villes réparties entre les
          États-Unis, le Canada et le Mexique. Voici la liste des villes et de
          leurs stades.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <p className="text-foreground/90">
            C&apos;est la première Coupe du Monde co-organisée par trois pays.
            Onze villes hôtes se situent aux États-Unis, deux au Canada et trois
            au Mexique. Le match d&apos;ouverture a lieu à l&apos;Estadio Azteca
            de Mexico, et la finale au MetLife Stadium de New York / New Jersey.
          </p>
        </section>

        {COUNTRIES.map((country) => {
          const cities = WC_HOST_CITIES.filter((c) => c.country === country);
          return (
            <section key={country}>
              <h2 className="text-foreground mb-3 flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden>{FLAG[country]}</span>
                {country}
                <span className="text-muted-foreground text-sm font-normal">
                  · {cities.length} ville{cities.length > 1 ? 's' : ''}
                </span>
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {cities.map((c) => (
                  <li
                    key={c.city}
                    className="bg-card border-border rounded-xl border p-3"
                  >
                    <p className="text-foreground font-semibold">{c.city}</p>
                    <p className="text-muted-foreground text-xs">
                      {c.stadium}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="bg-primary/5 border-primary/20 rounded-xl border p-4">
          <p className="text-foreground/90">
            Retour à la page{' '}
            <Link
              href="/coupe-du-monde-2026"
              className="text-primary font-semibold underline"
            >
              Coupe du Monde 2026
            </Link>{' '}
            pour suivre tous les matchs, les groupes et le bracket.
          </p>
        </section>
      </div>
    </main>
  );
}
