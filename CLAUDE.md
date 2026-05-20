# Tactuo

WebApp d'analyse football augmentée par l'IA. **Pas une app de paris sportifs.** Positionnement : "Voici tout ce qu'il faut comprendre avant le match", pas "voici ton pari".

## Deadline critique

- **Coup d'envoi Coupe du Monde 2026 : 11 juin 2026** (date de lancement public)
- **Code freeze : 9 juin 2026** (aucun déploiement après cette date)
- **Sprint total : 21 jours** (20 mai → 9 juin)

Voir `plan-mvp-cdm.md` pour le découpage jour par jour et l'architecture complète.

## Stack technique

- **Frontend** : Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (CLI v4, preset `nova` → composants Base UI, palette `neutral`)
- **Backend / DB** : Supabase (Postgres managé + Auth + Row Level Security)
- **Hébergement** : Vercel (frontend + cron jobs)
- **API football** : Football-Data.org (free tier, 10 req/min)
- **IA** : OpenAI gpt-4o-mini (analyses pré-match et post-match)
- **Emails** : Resend (3000 emails/mois gratuits)
- **Paiement** : Stripe (intégré côté serveur mais **paywall NON activé au lancement**)
- **Monitoring** : Sentry free tier

## Scope MVP — DANS

- Auth Supabase (signup, login, logout)
- Dashboard personnalisé selon favoris utilisateur
- Fiche match : infos générales, compos probables/officielles, stats, analyse IA pré-match, analyse IA post-match
- Fiche équipe : stats saison, forme, classement, derniers et prochains matchs
- Fiche joueur : stats principales, dernières performances
- Système de favoris (équipes, joueurs, matchs)
- Score brut affiché pendant les matchs (pas de stats live)
- 3 notifications email : compo officielle sortie, début du match, résultat final
- SEO : pages matchs/équipes/joueurs publiques et indexables

## Scope MVP — HORS (V1.5/V2)

- Chat IA conversationnel
- Stats live détaillées pendant matchs
- Push web notifications
- Feed personnalisé type TikTok
- Mini-clips et contenu vidéo
- Comparaison équipes avec radars
- Recherche globale avancée
- Module prédictions IA détaillées
- Activation paywall Stripe
- App native iOS/Android

## Stratégie données (critique pour tenir le free tier)

**Toutes les données football sont stockées en base Supabase. Aucun appel API foot depuis le frontend.**

Les cron jobs Vercel alimentent la base selon les rythmes suivants :

- **Structures** (joueurs, équipes, compétitions, calendrier) : refresh hebdo, lundi 4h
- **Classements et forme équipes** : refresh quotidien, 6h
- **Compositions probables** : refresh horaire pendant J-1
- **Compositions officielles + scores** : refresh toutes les 2-3 min de H-2 à H+2
  ⚠️ Vercel Hobby limite à **2 cron jobs maximum**. `vercel.json` ne déclare donc que `refresh-structures` (hebdo) et `refresh-rankings` (quotidien). La route `refresh-matchday` existe (`app/api/cron/refresh-matchday/route.ts`) mais sans schedule auto tant qu'on n'est pas passé Vercel Pro. À réactiver dans `vercel.json` après upgrade.
  ⚠️ **Football-Data.org free tier ne fournit PAS les lineups** (champs `homeTeam.lineup`/`bench` absents, gated par TIER_ONE+). La fiche match (`/matches/[id]`) affiche un empty state "Compositions à venir". Pour avoir les compos il faudra : soit upgrade Football-Data, soit ajouter une seconde source (API-Football a un free tier généreux sur ce point). À trancher avant Jour 17 (affichage analyses IA, qui se basent sur les lineups officielles).
  ⚠️ Le free tier n'expose pas non plus les **stats détaillées match-équipe** (`possession`, `shots`, `corners`...) ni les **stats joueur match-à-match** (rating, passes, etc.). Les tables `match_team_stats` et `match_player_stats` restent vides ; les sections affichent un empty state. Même remédiation que pour les lineups (upgrade ou API secondaire). Les `player_season_stats` non plus — la fiche joueur ne montre que les infos perso + le club tant qu'on n'a pas une seconde source.
- **Analyses IA** : générées 1 fois, déclenchées par l'arrivée de la compo officielle (pré-match) ou le passage du match en `finished` (post-match). **Jamais régénérées.**

## Couverture compétitions au lancement

Top 5 européen (Premier League, Liga, Serie A, Bundesliga, Ligue 1) + Champions League + **Coupe du Monde 2026 en priorité**. Pas de Ligue 2, pas de divisions inférieures.

## Conventions

- **Langue projet** : français (UI, commits, messages d'erreur, commentaires non-techniques)
- **Tables Supabase** : snake_case pluriel (`teams`, `match_lineups`, `player_season_stats`)
- **Composants React** : PascalCase
- **Routes App Router** : kebab-case (`/players/[id]`, `/matches/[id]`)
- **Variables d'environnement** : préfixe `NEXT_PUBLIC_` pour le client, sans préfixe pour le serveur
- **RLS Supabase** : activée sur toutes les tables utilisateur (`profiles`, `user_favorites`, `notification_log`). Lecture publique sur les tables de données football, écriture réservée au service role.
- **Tests** : optionnels Sprint 1-2, ajouter quelques tests critiques en Sprint 3 (paiement futur, auth, cron)

## Structure de dossiers attendue

```
app/
  (auth)/login/page.tsx
  (auth)/signup/page.tsx
  (public)/matches/[id]/page.tsx
  (public)/teams/[id]/page.tsx
  (public)/players/[id]/page.tsx
  dashboard/page.tsx
  favoris/page.tsx
  api/cron/refresh-structures/route.ts
  api/cron/refresh-rankings/route.ts
  api/cron/refresh-matchday/route.ts
  api/cron/generate-analysis/route.ts
components/
  ui/                  (shadcn)
  match/
  team/
  player/
  shared/
lib/
  supabase/server.ts
  supabase/client.ts
  football-api/client.ts
  football-api/mappers.ts
  openai/analyses.ts
  emails/resend.ts
  utils/
types/
  database.ts          (généré depuis Supabase)
  football.ts
supabase/
  migrations/
```

## Décisions techniques actées

- Pas de chat IA au lancement (coût imprévisible)
- Pas de live stats détaillées (coût API + complexité)
- Score brut uniquement pendant matchs, refresh 2-3 min
- gpt-4o-mini retenu (rapport coût/qualité optimal pour analyses pré/post-match)
- Notifications par email uniquement au lancement (Resend)
- Stripe codé en backend mais paywall inactif jusqu'en juillet 2026

## Projections coût (mesurées en sprint)

- **OpenAI gpt-4o-mini** : ~$0.0001-0.0002 par analyse (mesuré : 520-527 tokens in / 222-318 out). 64 matchs CDM × 2 analyses = **~$0.02 pour toute la CDM**. Ajout des autres compétitions = ~$0.10-0.30 / mois. Très loin du budget 5-15€ du plan.
- **Football-Data.org** : free tier 10 req/min suffisant pour les crons actuels. Tous les appels passent par les crons côté serveur, indépendants du nombre d'users.
- **Supabase** : free tier OK jusqu'à 500MB DB / 2GB bande passante. Notre DB actuelle : ~50MB après tout le sprint.
- **Vercel Hobby** : OK tant qu'on est < ~100GB bande passante / mois. Limite des 2 cron jobs blocking pour refresh-matchday sub-10min.
- **Resend** : free tier 3000 emails/mois. À 100 users × 5 emails/mois CDM = 500 emails. Très loin.

## Checklist pré-lancement (à valider avant le 11/06)

- [ ] Toutes les env vars Vercel présentes : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`
- [ ] `refresh-structures` a tourné au moins une fois ces dernières 72h (sinon : trigger manuel)
- [ ] `refresh-rankings` a tourné dans les 24h
- [ ] Pré-générer les analyses pré-match des matchs CDM via `/api/cron/generate-analysis` une fois les équipes confirmées
- [ ] Upgrade Vercel Pro pour activer `refresh-matchday` à \*/3 (sinon scores live à +10min) — voir mémoire `project_vercel_pro_upgrade.md`
- [ ] Vérifier domaine Resend custom OU avertir que les emails ne partent qu'à l'email du compte Resend (free tier shared domain)
- [ ] Ajouter `NEXT_PUBLIC_SENTRY_DSN` dans Vercel pour activer le monitoring (optionnel mais recommandé)
- [ ] Tester signup + favoris + visualisation analyse IA sur prod avant le coup d'envoi
- [ ] Monitoring rapproché H+0 à H+48 le 11 juin

## Comportement attendu de Claude Code

- Avancer par petites étapes, valider à chaque étape avant la suivante
- Demander confirmation avant toute décision technique non-triviale qui n'est pas couverte ici ou dans `plan-mvp-cdm.md`
- Prioriser la vitesse de livraison sur la perfection du code (refactor possible après le 11 juin)
- Flagger immédiatement tout dépassement de quota API foot ou de coût IA estimé
- Écrire des commits clairs et atomiques en français
- Ne pas créer de documentation excessive (README, docs/) sans demande explicite

## Référence

Plan détaillé du sprint 21 jours, architecture complète, schéma base de données, estimation des coûts : voir `plan-mvp-cdm.md` à la racine.
