import type { Metadata } from 'next';
import { ArrowRight, Swords, User, Users } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Comparer — Équipes ou joueurs',
  description:
    'Compare 2 équipes ou 2 joueurs côte à côte : radar des forces, stats détaillées, forme et confrontations.',
};

export default function ComparePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 text-center">
        <p className="text-primary mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
          <Swords className="size-3.5" aria-hidden />
          Comparer
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Qui est le meilleur ?
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm sm:text-base">
          Choisis ton match. Compare 2 équipes ou 2 joueurs côte à côte avec un
          radar des forces, des stats détaillées et plus encore.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/compare/teams"
          className="bg-primary/10 border-primary/20 hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-6 transition-all hover:shadow-lg"
        >
          <div className="bg-primary/20 pointer-events-none absolute -top-12 -right-12 size-48 rounded-full blur-3xl transition-opacity group-hover:opacity-80" />
          <div className="relative">
            <div className="bg-primary/15 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
              <Users className="size-6" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              Équipe vs Équipe
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Radar pentagonal des forces, comparaison statistique détaillée,
              forme récente et confrontations directes.
            </p>
            <div className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-semibold">
              Démarrer la comparaison
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </div>
          </div>
        </Link>

        <Link
          href="/compare/players"
          className="bg-primary/10 border-primary/20 hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-6 transition-all hover:shadow-lg"
        >
          <div className="bg-emerald-400/15 pointer-events-none absolute -top-12 -right-12 size-48 rounded-full blur-3xl transition-opacity group-hover:opacity-80" />
          <div className="relative">
            <div className="bg-primary/15 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
              <User className="size-6" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              Joueur vs Joueur
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Radar des skills (buts, passes, productivité, discipline),
              stats saison et productivité par match.
            </p>
            <div className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-semibold">
              Démarrer la comparaison
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
