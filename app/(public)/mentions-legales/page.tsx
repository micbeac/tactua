import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description:
    'Mentions légales du site Tactuo : éditeur, hébergeur, propriété intellectuelle et conditions d\'utilisation.',
  alternates: { canonical: '/mentions-legales' },
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Informations légales
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Mentions légales
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Dernière mise à jour : mai 2026.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Éditeur du site
          </h2>
          <p className="text-foreground/90">
            Le site Tactuo (accessible à l&apos;adresse{' '}
            <span className="text-foreground">www.tactuo.com</span>) est édité
            par :
          </p>
          <ul className="text-foreground/90 mt-2 list-none space-y-1">
            <li>Éditeur : Michael Beauclercq</li>
            <li>Statut : éditeur personne physique</li>
            <li>
              Adresse : Clos de la Mare aux Loups 22, 1330 Rixensart, Belgique
            </li>
            <li>
              Contact :{' '}
              <a
                href="mailto:contact@tactuo.com"
                className="text-primary underline"
              >
                contact@tactuo.com
              </a>
            </li>
            <li>Directeur de la publication : Michael Beauclercq</li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Hébergeur
          </h2>
          <p className="text-foreground/90">
            Le site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut,
            CA 91789, États-Unis —{' '}
            <a
              href="https://vercel.com"
              className="text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              vercel.com
            </a>
            .
          </p>
          <p className="text-muted-foreground mt-2">
            Les données applicatives (comptes utilisateurs, favoris) sont
            stockées via Supabase, dont l&apos;infrastructure de base de données
            est localisée dans l&apos;Union européenne (région Francfort,
            Allemagne).
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Propriété intellectuelle
          </h2>
          <p className="text-foreground/90">
            La structure du site, sa charte graphique, ses textes éditoriaux et
            le nom « Tactuo » sont la propriété de l&apos;éditeur. Toute
            reproduction ou réutilisation sans autorisation est interdite. Les
            logos de clubs, noms d&apos;équipes et de compétitions appartiennent
            à leurs détenteurs respectifs et sont affichés à des fins
            d&apos;information.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Sources de données
          </h2>
          <p className="text-foreground/90">
            Les données football proviennent de fournisseurs tiers
            (Football-Data.org, API-Football). Les analyses sont générées par un
            modèle d&apos;intelligence artificielle à partir de ces données.
            Tactuo s&apos;efforce d&apos;assurer l&apos;exactitude des
            informations mais ne peut garantir l&apos;absence totale
            d&apos;erreur. La démarche est détaillée sur la page Méthodologie.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Nature du service
          </h2>
          <p className="text-foreground/90">
            Tactuo est un service d&apos;analyse et d&apos;information sportive.{' '}
            <strong className="text-primary">
              Ce n&apos;est pas un service de paris sportifs
            </strong>{' '}
            : aucun conseil de pari, aucune incitation à parier n&apos;est
            fournie. Les probabilités et scénarios présentés sont des outils de
            compréhension d&apos;un match, sans valeur de pronostic garanti.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Responsabilité
          </h2>
          <p className="text-foreground/90">
            L&apos;éditeur ne saurait être tenu responsable des dommages
            résultant de l&apos;utilisation du site, d&apos;une indisponibilité
            temporaire, ou d&apos;une inexactitude des données fournies par les
            sources tierces.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Données personnelles
          </h2>
          <p className="text-foreground/90">
            Le traitement des données personnelles est décrit dans notre{' '}
            <a href="/confidentialite" className="text-primary underline">
              politique de confidentialité
            </a>
            .
          </p>
        </section>

        <p className="text-muted-foreground border-border border-t pt-4 text-xs">
          Ce document est un modèle de mentions légales. Les champs marqués
          « [À COMPLÉTER] » doivent être renseignés avec les informations
          réelles de l&apos;éditeur avant la mise en ligne publique. Il ne
          constitue pas un conseil juridique.
        </p>
      </div>
    </main>
  );
}
