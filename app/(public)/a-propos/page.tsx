import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'À propos de Tactuo',
  description:
    "Tactuo, c'est l'analyse foot augmentée par l'IA — comprendre un match avant le coup d'envoi, sans jamais parier. Notre mission, notre approche.",
  alternates: { canonical: '/a-propos' },
};

export default function AProposPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Qui sommes-nous
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          À propos de Tactuo
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          L&apos;analyse foot augmentée par l&apos;IA. Comprendre un match avant
          le coup d&apos;envoi — pas parier dessus.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Notre mission
          </h2>
          <p className="text-foreground/90">
            Avant chaque match, il y a une montagne de données : classements,
            forme, compositions, blessures, confrontations directes, xG…
            Personne n&apos;a le temps de tout lire. Tactuo fait ce travail à ta
            place et te restitue l&apos;essentiel :{' '}
            <strong className="text-primary">
              tout ce qu&apos;il faut comprendre avant le match
            </strong>
            , en quelques minutes de lecture.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Notre approche
          </h2>
          <p className="text-foreground/90">
            On agrège des statistiques football vérifiables auprès de sources
            professionnelles, puis on demande à un modèle d&apos;IA de les lire
            et de les expliquer clairement. L&apos;IA n&apos;invente rien : elle
            synthétise ce que les chiffres disent. Le détail complet de la
            démarche est expliqué sur notre page{' '}
            <Link href="/methodologie" className="text-primary underline">
              Méthodologie
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Ce que tu trouves sur Tactuo
          </h2>
          <ul className="text-foreground/90 list-disc space-y-1.5 pl-5">
            <li>
              Des fiches match avec compositions probables et officielles,
              stats et analyse IA pré-match.
            </li>
            <li>
              Des fiches équipe et joueur : forme, classement, statistiques de
              la saison.
            </li>
            <li>
              Un suivi personnalisé de tes équipes et joueurs préférés, avec les
              notifications essentielles.
            </li>
            <li>
              Une couverture du Top 5 européen, de la Champions League et de
              toute la Coupe du Monde 2026.
            </li>
          </ul>
        </section>

        <section className="bg-primary/5 border-primary/20 rounded-xl border p-4">
          <h2 className="text-primary mb-2 text-lg font-semibold">
            Tactuo n&apos;est pas une app de paris
          </h2>
          <p className="text-foreground/90">
            On le répète parce que c&apos;est central : Tactuo fournit des
            probabilités et des scénarios pour <em>comprendre</em> un match,
            jamais un conseil de pari ni une incitation à parier. Notre produit
            s&apos;adresse aux passionnés de football, pas aux parieurs.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Nous contacter
          </h2>
          <p className="text-foreground/90">
            Une question, une remarque, une erreur repérée dans une analyse ?
            Écris-nous à{' '}
            <a
              href="mailto:contact@tactuo.com"
              className="text-primary underline"
            >
              contact@tactuo.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
