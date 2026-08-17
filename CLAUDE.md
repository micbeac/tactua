# Tactuo

WebApp d'analyse football augmentée par l'IA. **Pas une app de paris sportifs.** Positionnement : "Voici tout ce qu'il faut comprendre avant le match", pas "voici ton pari".

- **Prod** : https://www.tactuo.com (`NEXT_PUBLIC_SITE_URL` pointe dessus ; sans la var, fallback sur `tactua.vercel.app`)
- **Repo** : `micbeac/tactua`
- **Statut** : lancé publiquement le 11 juin 2026 pour la Coupe du Monde. Le tournoi est terminé (19 juillet 2026) ; le site couvre désormais la saison de clubs 2026-27.

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

Conséquences concrètes :

- ✅ **On peut ajouter autant de crons quotidiens qu'on veut, gratuitement.** Les jobs journaliers (news, digest, analyses, stats joueurs, narratives) peuvent tous être planifiés dans `vercel.json` dès maintenant.
- ❌ **`refresh-matchday` reste impossible sur Hobby** : il lui faut du `*/3`, qui fait échouer le déploiement (`Hobby accounts are limited to daily cron jobs`). Seules solutions : passer en Pro, ou déclencher l'endpoint depuis un service externe (cron-job.org, GitHub Actions).

`vercel.json` ne déclare aujourd'hui que :

- `refresh-structures` — lundi 4h (métadonnées, équipes, squads, calendrier)
- `refresh-rankings` — quotidien 6h (classements + forme récente)

**Les 8 autres routes cron existent mais ne sont pas planifiées** — la plupart pourraient l'être sans rien payer :

| Route | Rôle | Conséquence de l'absence de schedule |
|---|---|---|
| Route | Rôle | Planifiable sur Hobby ? |
|---|---|---|
| `refresh-matchday` | Scores + lineups + stats, fenêtre H-2 → H+24 | ❌ besoin de `*/3` → **Pro ou trigger externe** |
| `dispatch-notifications` | 3 events : compo confirmée, coup d'envoi, score final | ❌ besoin d'être infra-horaire |
| `generate-analysis` | Analyses IA pré/post-match | ⚠️ quotidien possible, mais rate les matchs du soir |
| `generate-news-content` | Rédaction IA des news scrapées | ✅ quotidien suffit |
| `refresh-narratives` | Scraping Apify de l'actu par équipe | ✅ quotidien (⚠️ lent, batcher) |
| `generate-content-angles` | Angles vidéo TikTok | ✅ quotidien suffit |
| `refresh-player-stats` | Stats joueurs par compétition | ✅ quotidien suffit |
| `send-daily-digest` | Digest email matinal | ✅ quotidien par définition |

→ Les 5 lignes ✅ peuvent être ajoutées à `vercel.json` sans rien payer. Seuls les scores live et les notifications temps réel justifient le passage en Pro.

⚠️ Le scraping Apify est lent (~15-30 s/équipe) et les fonctions Hobby coupent à 60 s : garder un `limit` bas.

Auth des crons : header `Authorization: Bearer ${CRON_SECRET}` (ou `x-cron-secret` selon la route — vérifier au cas par cas).

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
- **Football-Data** : free tier 10 req/min. **API-Football** : free tier 100 req/jour — c'est la contrainte la plus serrée, throttling en place dans `lib/api-football`.
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
