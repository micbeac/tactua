# Tactuo

WebApp d'analyse football augmentée par l'IA, **assumée jusqu'au terrain du pronostic**. Positionnement : « voici tout ce qu'il faut comprendre avant le match, chiffres et probabilités compris ».

- **Prod** : https://www.tactuo.com (`NEXT_PUBLIC_SITE_URL` pointe dessus ; sans la var, fallback sur `tactua.vercel.app`)
- **Repo** : `micbeac/tactua` — ⚠️ **public**
- **Statut** : lancé publiquement le 11 juin 2026 pour la Coupe du Monde. Le tournoi est terminé (19 juillet 2026) ; le site couvre désormais la saison de clubs 2026-27.

## Ligne éditoriale

Le positionnement a été élargi le 20/08/2026. L'ancienne règle « pas une app de paris, jamais de cote » ne s'applique plus.

**Ce que le contenu peut faire :**

- Afficher des **probabilités d'issue** et les assumer comme telles
- Citer le **consensus des marchés** (cotes agrégées) comme source, au lieu de le masquer
- Traiter les marchés classiques : 1N2, **BTTS**, over/under, handicaps, scores exacts
- Signaler un **écart entre notre lecture statistique et le marché** — c'est là qu'un modèle apporte de la valeur
- Employer le vocabulaire du pronostic : favori, outsider, valeur, confiance

⚠️ **Cet écart doit être réel.** Fournir le consensus des marchés au modèle de langage en lui demandant sa propre estimation ne marche pas : il recopie le consensus à l’identique — constaté le 21/08/2026, 45/28/27 en face de 45/28/27, écart nul sur les trois issues. Notre probabilité vient donc d’un calcul déterministe (`lib/stats/poisson.ts`), effectué AVANT que le modèle ne voie le marché. **Ne pas revenir à une probabilité rédigée par l’IA** : la comparaison ne comparerait plus rien.

**Les limites qui restent :**

- **Pas de conseil de mise** : jamais de montant, de bankroll, de « mise X € sur Y ». On éclaire une décision, on ne la prend pas.
- **L'incertitude va toujours avec le chiffre** : une probabilité n'est pas une prédiction. Un favori à 60 % perd 4 fois sur 10.
- **Aucune promesse de gain**, aucun historique de rentabilité présenté comme reproductible.
- ⚠️ **Contexte belge** : la Belgique encadre très strictement la publicité pour les jeux d'argent depuis 2023. L'analyse et les probabilités ne sont pas visées, mais **toute affiliation vers un bookmaker ou incitation directe à miser doit être validée juridiquement avant mise en ligne**.
- Prévoir une mention de jeu responsable si le site pousse plus loin dans cette direction.

⚠️ **Les prompts IA portent encore les anciennes interdictions** (`lib/openai/analyses.ts`, `content-angles.ts`, `wc-group-prediction.ts` : « ne mentionne JAMAIS de cote, de bookmaker, de pari »). Tant qu'elles ne sont pas levées, ce changement de ligne éditoriale reste sans effet sur le contenu généré.

## Stack technique

- **Frontend** : Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (preset `nova` → composants Base UI, palette `neutral`)
- **Backend / DB** : Supabase (Postgres managé + Auth + Row Level Security)
- **Hébergement** : Vercel Hobby (frontend + cron jobs)
- **APIs football** : Football-Data.org (structure : calendrier, classements) + API-Football (stats détaillées, lineups, ratings joueurs)
- **IA** : OpenAI — `gpt-4o-mini` pour les analyses pré/post-match, `gpt-4o` (DEEP_MODEL) pour la rédaction des news
- **Scraping actu** : Apify
- **Emails** : Resend · **Push** : web-push (VAPID) · **Monitoring** : Sentry · **Analytics** : Plausible
- **Paiement** : non implémenté. Le site est intégralement gratuit — aucun code Stripe en base de code aujourd'hui.

## Compétitions couvertes (et leurs IDs)

| ID | Code | Compétition |
|---|---|---|
| 2021 | `pl` | Premier League |
| 2014 | `pd` | La Liga |
| 2019 | `sa` | Serie A |
| 2002 | `bl1` | Bundesliga |
| 2015 | `fl1` | Ligue 1 |
| 2001 | `cl` | Champions League |
| 9001 | `bjl` | Jupiler Pro League |
| 2000 | `wc` | Coupe du Monde 2026 — **archive**, plus aucun match à venir |
| 9990 | — | Amicaux internationaux |

La CDM 2026 a été retirée des accordéons du dashboard (`app/page.tsx`) : son accordéon resterait vide en permanence. L'archive complète reste sur `/coupe-du-monde-2026`.

## Stratégie données

**Toutes les données football sont en base Supabase. Aucun appel API foot depuis le frontend.**

### ⚠️ Contrainte réelle de Vercel Hobby : la FRÉQUENCE, pas le nombre

**Le projet a longtemps cru être plafonné à 2 crons. C'est faux.** D'après la doc Vercel (vérifiée le 17/08/2026) :

| Plan | Crons par projet | Intervalle minimum | Précision |
|---|---|---|---|
| Hobby | **100** | **1× par jour** | ±59 min |
| Pro | 100 | 1× par minute | à la minute |

### Crons planifiés (`vercel.json`) — heures en **UTC**

| Heure | Route | Rôle |
|---|---|---|
| 2h | `refresh-narratives` | Scraping Apify de l'actu par équipe |
| 3h | `generate-news-content` | Rédaction IA des news scrapées |
| 4h | `refresh-structures?code=…` | Métadonnées, équipes, squads, calendrier — **une compétition par jour** : CL lundi, PL mardi, PD mercredi, SA jeudi, BL1 vendredi, FL1 samedi |
| 5h | `send-daily-digest` | Digest email matinal (7h Paris) |
| 6h | `refresh-rankings` | Classements + forme récente |
| 7h | `refresh-player-stats` | Stats joueurs par compétition |
| 8h | `generate-analysis` | Analyses IA pré/post-match |
| 9h | `generate-content-angles` | Angles vidéo TikTok |
| 10h | `refresh-jupiler` | Jupiler Pro League : équipes, calendrier, classement |
| 11h (dim.) | `refresh-jupiler?part=squads` | Effectifs des clubs belges |

⚠️ La précision Hobby est de ±59 min : **ne jamais compter sur l'ordre d'exécution** entre deux jobs. Chaque route doit tolérer que la précédente n'ait pas encore tourné.

### Crons hors `vercel.json`

| Route | Rôle | État réel |
|---|---|---|
| `refresh-matchday` | Scores + lineups, fenêtre H-2 → H+24 | ✅ **déjà déclenché toutes les ~60 s** par un service externe, via `tactua.vercel.app` (constaté dans les logs le 17/08/2026) |
| `dispatch-notifications` | Compo confirmée, coup d'envoi, score final | ❓ à vérifier dans les logs avant de conclure |

⚠️ Ne pas répéter l'erreur consistant à déduire de `vercel.json` que ces routes ne tournent pas : un déclencheur externe existe et n'apparaît nulle part dans le dépôt. **Vérifier les logs (`vercel logs <url> --json`) avant d'affirmer qu'un job est inactif.**

Ces deux routes ne peuvent pas être mises dans `vercel.json` sur Hobby (il leur faut un intervalle infra-horaire), mais le trigger externe rend le passage en Pro beaucoup moins urgent qu'il n'y paraît.

### ⚠️ Timeout de 60 s sur les jobs longs

Football-Data plafonne à **10 req/min** et `refresh-structures` fait 3 appels par compétition : le run complet (7 compétitions) demande plus de 2 minutes de throttling incompressible et se faisait couper à 60 s.

**Résolu** en découpant le cron en une entrée par compétition — Vercel accepte les query strings dans les chemins de cron :

```
GET /api/cron/refresh-structures?code=PL
```

Chaque run tient alors largement dans les 60 s. La route trie aussi par `competitions.last_updated_at` croissant et s'arrête à 25 s, de sorte qu'un run sans paramètre reste exploitable.

⚠️ `competitions` est upsertée **en dernier** dans la boucle, volontairement : `last_updated_at` sert de curseur de reprise, l'écrire en début de boucle marquait comme à jour une compétition ensuite interrompue.

Les routes déclarant `maxDuration = 300` (`refresh-narratives`, `generate-news-content`, `refresh-player-stats`, `send-daily-digest`) sont dans le même cas : la déclaration est ignorée, Hobby coupe à 60 s.

⚠️ Le scraping Apify est lent (~15-30 s/équipe) et les fonctions Hobby coupent à 60 s : garder un `limit` bas.

Auth des crons : header `Authorization: Bearer ${CRON_SECRET}` (ou `x-cron-secret` selon la route — vérifier au cas par cas).

### ⚠️ Le piège de la fenêtre inter-saisons

Football-Data bascule `currentSeason` sur la saison suivante **avant** de réinitialiser son classement. Entre les deux, `/standings` renvoie la table finale de l'an dernier étiquetée avec la saison à venir.

Constaté le 17/08/2026 : la Ligue 1 avait 34 matchs joués et 76 points enregistrés sous `season = '2026'`, si bien que les fiches équipe présentaient le classement 2025-26 comme celui du moment.

Deux protections en place, à ne pas retirer :

1. `refresh-rankings` **ignore** un classement dont la saison n'a pas encore commencé mais qui annonce des matchs joués.
2. Toute lecture de `team_season_stats` doit trier **par `season` DESC en clé primaire**. Le tri par points départage les compétitions d'une même saison (championnat avant Coupe d'Europe) ; utilisé seul, il fait remonter la saison précédente terminée, plus riche en points, devant la saison en cours qui démarre à 0.

Le même réflexe vaut pour les stats joueurs : `refresh-player-stats` calcule sa saison via `currentSeason()` (`lib/season.ts`, bascule au 1er juillet) et non par une constante.

### ⚠️ La Jupiler Pro League ne passe pas par Football-Data

FD ne la couvre pas : `refresh-structures` et `refresh-rankings` la sautent explicitement (`if (code === 'BJL') continue;`). Tout passe par API-Football, via `lib/api-football/jupiler.ts` et le cron `refresh-jupiler`.

Conventions d'identifiants à respecter, sous peine de dédoubler les lignes existantes :

- `team_id` = `api_football_id + 50 000`, **sauf** si l'équipe est déjà en base via une autre compétition (Coupe d'Europe) — on garde alors son id Football-Data
- `match_id` = `fixture_id + 9 000 000`
- pour un joueur déjà connu, on réutilise son id interne ; l'id API-Football brut ne sert que pour les inconnus

⚠️ L'import doit écrire `competitions.current_season` : la page `/competitions/[code]` lit ce champ puis filtre le classement dessus. L'oublier alimente la nouvelle saison pendant que la page continue d'afficher l'ancienne.

Les scripts `scripts/import-jupiler-pro-league.ts` et `scripts/refresh-jpl-squads.ts` restent utiles en local mais sont désormais redondants — et leur `SEASON` est figé, ne pas s'y fier.

### Règles métier

- **Analyses IA** : générées une seule fois, jamais régénérées.
- **Faits dérivés de la base, pas codés en dur.** Le vainqueur de la CDM vient de `getWCChampion()` (`lib/data/world-cup.ts`), qui lit la finale en base. C'est délibéré : le site est resté figé 3 mois sur du contenu écrit au futur parce que les dates et statuts étaient hardcodés. Ne pas réintroduire ce motif.

## Conventions

- **Langue projet** : français (UI, commits, messages d'erreur, commentaires)
- **Tables Supabase** : snake_case pluriel (`teams`, `match_lineups`, `player_season_stats`)
- **Composants React** : PascalCase · **Routes App Router** : kebab-case
- **URLs entités** : `slug-id` (`/teams/paris-saint-germain-524`) — helpers dans `lib/url.ts`, avec 301 vers la canonique si le slug diffère
- **Env** : préfixe `NEXT_PUBLIC_` pour le client, sans préfixe côté serveur
- **RLS** : activée sur les tables utilisateur (`profiles`, `user_favorites`, `notification_log`). Lecture publique sur les tables football, écriture réservée au service role.

## Structure

```
app/
  (auth)/          login, signup, reset-password, update-password
  (public)/        matches, teams, players, competitions, news, compare,
                   coupe-du-monde-2026 (+ actu, calendrier, format, villes-hotes),
                   pages éditoriales (a-propos, methodologie, precision) et légales
  admin/           back-office : users, emails, promo-codes, partners, videos,
                   wc-news, cdm, contenu, push
  account/         historique, notifications
  api/cron/        10 routes (voir tableau ci-dessus)
  dashboard = app/page.tsx (landing si déconnecté, dashboard si connecté)
  favoris/, quiz/, search/
components/        ui (shadcn), match, team, player, landing, dashboard, admin,
                   compare, news, push, quiz, video, seo, shared, account,
                   competition, favorites
lib/               supabase, football-api, api-football, openai, emails, news,
                   notifications, push, apify, content, data, cron
supabase/migrations/   27 migrations
scripts/           backfills, imports, tests (exécution locale via tsx)
```

## Fonctionnalités au-delà du MVP initial

Auth, favoris, dashboard, fiches match/équipe/joueur, analyses IA pré/post-match, **plus** : quiz, notifications push (PWA), digest email quotidien, récaps quotidien et hebdo, feed "pour toi", comparateur équipes/joueurs, fil d'actu IA (général + CDM), angles vidéo TikTok, images OG dynamiques par match/équipe/joueur, back-office admin complet, codes promo, partenaires.

## SEO

- `sitemap.ts` génère les entrées statiques + matchs, équipes, joueurs, news, news CDM (caps : 500 équipes, 5000 joueurs / matchs / news)
- `robots.ts` bloque `/api/`, `/auth/`, `/favoris` et les pages d'auth
- JSON-LD : Organization + WebSite (layout racine), FAQPage (landing, page CDM), SportsEvent et BreadcrumbList (fiches match)
- Canonical explicite sur la home (`app/page.tsx`) — ne **pas** en déclarer un dans le layout racine, il se propagerait à toutes les pages enfants

## Coûts observés

- **OpenAI** : ~$0.0001-0.0002 par analyse `gpt-4o-mini`. Négligeable. Les news en `gpt-4o` coûtent nettement plus — surveiller si le volume monte.
- **Football-Data** : free tier 10 req/min. **API-Football** : **plan Ultra** — le quota n'est pas un facteur limitant (un throttling reste en place dans `lib/api-football`, hérité de l'époque free tier).
- **Supabase** : free tier (500 MB / 2 GB bande passante).
- **Resend** : free tier 3000 emails/mois. ⚠️ Sans domaine custom vérifié, les emails ne partent qu'à l'adresse du compte Resend.

## Lint

`pnpm lint` est **rouge sur main** (~15 erreurs préexistantes) : `prefer-const` dans `scripts/`, `react-hooks/purity` sur des `Date.now()` en render, `react-hooks/set-state-in-effect`. Ne pas confondre avec une régression introduite par un changement en cours — vérifier les numéros de ligne contre le diff.

## Comportement attendu de Claude Code

- Avancer par petites étapes, valider à chaque étape
- Demander confirmation avant toute décision technique non-triviale non couverte ici
- Écrire des commits clairs et atomiques en français
- Ne pas créer de documentation (README, docs/) sans demande explicite
- **Se méfier du contenu daté** : préférer une donnée dérivée de la base à une date ou un statut écrit en dur dans le JSX
