import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Méthodologie — comment Tactuo analyse les matchs',
  description:
    "Sources de données, modèle d'IA, garde-fous : comment Tactuo construit ses analyses de match, et ce que l'IA ne fait pas.",
  alternates: { canonical: '/methodologie' },
};

export default function MethodologiePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Transparence
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Méthodologie
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Comment Tactuo construit ses analyses — sources, modèle, garde-fous.
          On préfère expliquer plutôt que faire deviner.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Le principe
          </h2>
          <p className="text-foreground/90">
            Tactuo ne devine pas. Chaque analyse est une{' '}
            <strong className="text-primary">synthèse de données réelles</strong>
            . On agrège des statistiques football vérifiables, puis on demande à
            un modèle d&apos;IA de les lire et de les restituer clairement. Le
            modèle n&apos;invente rien : il explique ce que les chiffres disent.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Les sources de données
          </h2>
          <ul className="text-foreground/90 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Football-Data.org</strong> — structure des compétitions :
              calendrier, classements, résultats.
            </li>
            <li>
              <strong>API-Football</strong> — données détaillées : compositions,
              statistiques d&apos;équipe et de joueur, xG (buts attendus),
              blessures et suspensions, confrontations directes.
            </li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Les données sont rafraîchies en continu par des tâches automatisées
            (structures, classements, scores en direct, compositions).
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Le modèle d&apos;IA
          </h2>
          <p className="text-foreground/90">
            Les analyses pré-match approfondies sont générées par un modèle
            OpenAI de la famille GPT-4o. Le modèle reçoit, pour chaque match, une
            douzaine de familles de données : bilan saison domicile/extérieur,
            meilleurs joueurs et leur forme, xG marqué et concédé, blessures et
            suspensions, confrontations directes, fraîcheur (jours de repos,
            calendrier), enjeu au classement, tempo des buts, entraîneur, et un
            consensus probabiliste de calibrage.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Les garde-fous
          </h2>
          <ul className="text-foreground/90 list-disc space-y-1.5 pl-5">
            <li>
              Le modèle ne peut citer que des joueurs réellement présents dans
              les données fournies — aucune invention de nom.
            </li>
            <li>
              Les joueurs partis au mercato sont explicitement exclus de
              l&apos;analyse.
            </li>
            <li>
              La sortie est contrainte par un schéma strict : pas de
              hors-sujet, des champs précis, des chiffres sourcés.
            </li>
          </ul>
        </section>

        <section className="bg-primary/5 border-primary/20 rounded-xl border p-4">
          <h2 className="text-primary mb-2 text-lg font-semibold">
            Ce que Tactuo ne fait PAS
          </h2>
          <p className="text-foreground/90">
            Tactuo n&apos;est <strong>pas une application de paris sportifs</strong>
            . On fournit des probabilités et des scénarios pour{' '}
            <em>comprendre</em> un match — jamais un conseil de pari, jamais une
            incitation à parier. Le positionnement est clair : « voici tout ce
            qu&apos;il faut comprendre avant le match », pas « voici ton pari ».
          </p>
        </section>
      </div>
    </main>
  );
}
