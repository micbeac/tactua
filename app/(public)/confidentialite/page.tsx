import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Comment Tactuo collecte, utilise et protège tes données personnelles : compte, favoris, analytics respectueux de la vie privée.',
  alternates: { canonical: '/confidentialite' },
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Vie privée
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Politique de confidentialité
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Dernière mise à jour : mai 2026. On collecte le strict minimum, et on
          l&apos;explique en clair.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Responsable du traitement
          </h2>
          <p className="text-foreground/90">
            Le responsable du traitement des données est l&apos;éditeur du site
            Tactuo (voir la page{' '}
            <a href="/mentions-legales" className="text-primary underline">
              Mentions légales
            </a>
            ). Pour toute question relative à tes données, écris à{' '}
            <a
              href="mailto:contact@tactuo.com"
              className="text-primary underline"
            >
              contact@tactuo.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Données que nous collectons
          </h2>
          <ul className="text-foreground/90 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Compte</strong> — ton adresse e-mail, utilisée pour
              l&apos;authentification et l&apos;envoi des notifications.
            </li>
            <li>
              <strong>Favoris</strong> — les équipes, joueurs, matchs et
              compétitions que tu choisis de suivre, pour personnaliser ton
              tableau de bord.
            </li>
            <li>
              <strong>Préférences de notification</strong> — les types
              d&apos;e-mails que tu acceptes de recevoir.
            </li>
            <li>
              <strong>Statistiques d&apos;usage</strong> — des mesures
              d&apos;audience agrégées et anonymes (voir « Mesure
              d&apos;audience » ci-dessous).
            </li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Nous ne collectons aucune donnée bancaire et ne demandons jamais de
            mot de passe en dehors du formulaire d&apos;authentification
            sécurisé.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Finalités et base légale
          </h2>
          <ul className="text-foreground/90 list-disc space-y-1.5 pl-5">
            <li>
              Fournir le service (compte, favoris, analyses) — base légale :
              exécution du contrat.
            </li>
            <li>
              Envoyer les notifications e-mail que tu as choisies — base
              légale : ton consentement, révocable à tout moment.
            </li>
            <li>
              Mesurer l&apos;audience pour améliorer le site — base légale :
              intérêt légitime (mesure anonyme, sans cookie).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Mesure d&apos;audience
          </h2>
          <p className="text-foreground/90">
            Tactuo utilise Plausible Analytics, un outil de mesure
            d&apos;audience respectueux de la vie privée.{' '}
            <strong className="text-primary">
              Il ne dépose aucun cookie
            </strong>{' '}
            et ne collecte aucune donnée personnelle identifiante : les
            statistiques sont entièrement agrégées et anonymes. C&apos;est
            pourquoi Tactuo n&apos;affiche pas de bandeau de cookies. Nous
            n&apos;utilisons aucun traceur publicitaire tiers.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Sous-traitants
          </h2>
          <p className="text-foreground/90">
            Pour faire fonctionner le service, nous faisons appel à des
            prestataires techniques :
          </p>
          <ul className="text-foreground/90 mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Supabase</strong> — authentification et base de données
              (hébergement dans l&apos;UE).
            </li>
            <li>
              <strong>Vercel</strong> — hébergement du site.
            </li>
            <li>
              <strong>Resend</strong> — envoi des e-mails de notification.
            </li>
            <li>
              <strong>Plausible Analytics</strong> — mesure d&apos;audience
              anonyme.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Durée de conservation
          </h2>
          <p className="text-foreground/90">
            Tes données de compte et tes favoris sont conservés tant que ton
            compte est actif. À la suppression du compte, ces données sont
            effacées.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Tes droits
          </h2>
          <p className="text-foreground/90">
            Conformément au RGPD, tu disposes d&apos;un droit d&apos;accès, de
            rectification, d&apos;effacement, de limitation et de portabilité de
            tes données, ainsi que du droit de retirer ton consentement. Pour
            exercer ces droits, écris à{' '}
            <a
              href="mailto:contact@tactuo.com"
              className="text-primary underline"
            >
              contact@tactuo.com
            </a>
            . Tu peux également introduire une réclamation auprès de
            l&apos;autorité de protection des données compétente.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Modifications
          </h2>
          <p className="text-foreground/90">
            Cette politique peut évoluer. Toute modification importante sera
            signalée sur cette page, avec mise à jour de la date en en-tête.
          </p>
        </section>

        <p className="text-muted-foreground border-border border-t pt-4 text-xs">
          Ce document est un modèle de politique de confidentialité. Il décrit
          le fonctionnement réel du service mais doit être revu, complété (champs
          de l&apos;éditeur) et validé avant la mise en ligne publique. Il ne
          constitue pas un conseil juridique.
        </p>
      </div>
    </main>
  );
}
