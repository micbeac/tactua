import type { Metadata } from 'next';
import Link from 'next/link';
import { WC_FACTS, WC_STAGES } from '@/lib/content/world-cup';

export const metadata: Metadata = {
  title: 'Format de la Coupe du Monde 2026 : 48 équipes, 12 groupes',
  description:
    'Comment fonctionne le nouveau format de la Coupe du Monde 2026 : 48 équipes, 12 groupes de 4, 104 matchs, qualification des meilleurs troisièmes et phase à élimination directe.',
  alternates: { canonical: '/coupe-du-monde-2026/format' },
};

export default function FormatPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-muted-foreground mb-6 text-xs">
        <Link href="/coupe-du-monde-2026" className="hover:text-primary">
          Coupe du Monde 2026
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Format</span>
      </nav>

      <header className="mb-8">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Guide
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Le format de la Coupe du Monde 2026
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          La Coupe du Monde 2026 inaugure un format élargi à 48 équipes. Voici
          comment se déroule la compétition, de la phase de groupes à la finale.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Une Coupe du Monde à 48 équipes
          </h2>
          <p className="text-foreground/90">
            Pour la première fois de son histoire, la Coupe du Monde réunit{' '}
            <strong className="text-primary">48 sélections</strong>, contre 32
            lors des éditions précédentes. Cet élargissement porte le nombre
            total de rencontres à <strong>104 matchs</strong>, disputés du{' '}
            {WC_FACTS.startLabel} au {WC_FACTS.endLabel} aux États-Unis, au
            Canada et au Mexique.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            La phase de groupes
          </h2>
          <p className="text-foreground/90">
            Les 48 équipes sont réparties en{' '}
            <strong>12 groupes de 4 équipes</strong>. Chaque sélection dispute
            trois matchs de poule. À l&apos;issue de cette phase, se qualifient
            pour le tableau final :
          </p>
          <ul className="text-foreground/90 mt-2 list-disc space-y-1.5 pl-5">
            <li>les deux premiers de chacun des 12 groupes (24 équipes) ;</li>
            <li>
              les huit meilleurs troisièmes, départagés selon les points puis
              la différence de buts (8 équipes).
            </li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Soit 32 équipes qualifiées pour la phase à élimination directe.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            La phase à élimination directe
          </h2>
          <p className="text-foreground/90">
            Nouveauté du format à 48 : le tableau final débute par des{' '}
            <strong>16ᵉ de finale</strong>. À partir de là, chaque tour élimine
            la moitié des équipes jusqu&apos;à la finale.
          </p>
          <ol className="mt-3 space-y-2">
            {WC_STAGES.map((s, i) => (
              <li
                key={s.label}
                className="bg-card border-border rounded-xl border p-4"
              >
                <p className="text-foreground flex items-center gap-2 font-semibold">
                  <span className="bg-primary/15 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
                    {i + 1}
                  </span>
                  {s.label}
                </p>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  {s.detail}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-primary/5 border-primary/20 rounded-xl border p-4">
          <p className="text-foreground/90">
            Suis la phase de groupes en direct, les classements et le bracket
            des phases finales sur la page{' '}
            <Link
              href="/coupe-du-monde-2026"
              className="text-primary font-semibold underline"
            >
              Coupe du Monde 2026
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
