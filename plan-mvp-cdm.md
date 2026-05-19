# Plan MVP — WebApp Analyse Football IA

## Sprint Coupe du Monde 2026 (21 jours)

**Date de rédaction :** 19 mai 2026
**Date de freeze :** 9 juin 2026
**Date de lancement :** 11 juin 2026 (coup d'envoi CDM)
**Durée totale du sprint :** 21 jours

---

## 1. Périmètre MVP final

### Ce qui est dans le MVP (à livrer le 11 juin)

Authentification utilisateur (inscription, connexion, déconnexion via Supabase Auth). Dashboard d'accueil personnalisé selon les favoris de l'utilisateur, avec matchs du jour, prochains matchs CDM, équipes favorites mises en avant. Fiches matchs complètes contenant infos générales (heure, stade, arbitre, compétition), forme des deux équipes, historique des confrontations, compositions probables puis officielles, analyse IA pré-match, analyse IA post-match. Fiches équipes avec stats de la saison/compétition en cours, forme récente (5 derniers matchs), classement, derniers résultats. Fiches joueurs avec stats principales (buts, assists, minutes, cartons), dernières performances, club et sélection nationale. Système de favoris pour suivre équipes, joueurs et matchs. Score brut affiché pendant les matchs (chiffre seul, refresh toutes les 2-3 minutes, pas de stats live). Notifications email pour 3 événements critiques sur les favoris : composition officielle sortie, début du match, résultat final.

### Ce qui passe en V1.5 ou V2 (après la CDM)

Activation du paywall Stripe (l'intégration sera faite en backend mais aucune fonctionnalité ne sera payante au lancement). Chat IA conversationnel. Stats live détaillées pendant les matchs (timeline, xG live, événements). Notifications push web (Service Worker, VAPID). Feed personnalisé type TikTok. Comparaison équipes avec radars et visualisations avancées. Mini-clips et contenu vidéo. Recherche globale avancée avec autocomplétion sur tout le catalogue. Module de prédictions IA détaillées (BTTS, over/under, etc. avec explication complète). Système d'alertes intelligentes pendant les matchs (momentum, xG élevé). Heatmaps joueurs.

### Arbitrages déjà actés

Le live détaillé est exclu pour des raisons de coût API et de complexité. Le chat IA est exclu pour des raisons de coût et de prédictibilité. Stripe sera codé mais pas activé pour maximiser l'acquisition pendant la CDM. Seules les compétitions du top 5 européen et internationales (CDM en priorité) sont couvertes. Pas d'app native iOS ou Android, webapp responsive uniquement.

---

## 2. Stack et architecture technique

### Stack

Frontend : Next.js 16 avec App Router, TypeScript, Tailwind CSS v4, shadcn/ui (CLI v4, preset `nova` → composants Base UI, palette `neutral`) pour les composants. Backend et base de données : Supabase (Postgres managé, Auth, Row Level Security). Hébergement : Vercel pour le frontend, Supabase Cloud pour la base. API football : Football-Data.org en tier gratuit (10 requêtes par minute, couvre CDM + top 5 européen + Champions League). IA : OpenAI gpt-4o-mini pour les analyses pré et post-match (rapport coût/qualité optimal pour ce cas d'usage). Emails transactionnels : Resend (3000 emails/mois gratuits). Cron jobs : Vercel Cron Jobs (gratuits sur le plan hobby, suffisants au lancement). Stripe sera intégré côté serveur mais inactif. Monitoring : Sentry en free tier pour traquer les erreurs.

### Stratégie de cache (critique pour tenir dans le free tier)

Toutes les données football sont stockées en base. Aucune page utilisateur ne fait d'appel direct à l'API foot — elle lit toujours depuis Supabase. Les cron jobs alimentent la base selon les rythmes suivants. Données quasi-statiques (joueurs, équipes, compétitions, calendrier) : refresh une fois par semaine, le lundi à 4h. Classements et forme des équipes : refresh une fois par jour à 6h. Compositions probables : refresh toutes les heures la veille du match (J-1). Compositions officielles et scores : refresh toutes les 2-3 minutes de H-2 à H+2 autour du match (H = heure de coup d'envoi). Analyses IA : générées une seule fois, déclenchées par l'arrivée de la composition officielle (pré-match) ou la fin du match (post-match), stockées en base et servies à tous les utilisateurs.

Cette stratégie permet de tenir 50 à 200 utilisateurs avec le free tier Football-Data.org sans difficulté.

### Structure des routes Next.js (App Router)

`/` dashboard public ou personnalisé selon authentification. `/login` et `/signup` pour l'auth. `/competitions/[slug]` page compétition (CDM, Liga, etc.). `/matches/[id]` fiche match complète. `/teams/[id]` fiche équipe. `/players/[id]` fiche joueur. `/favoris` page de gestion des favoris. `/account` paramètres du compte. `/api/cron/*` endpoints Vercel Cron (protégés par token). `/api/webhooks/*` endpoints internes (Stripe pour plus tard).

Les pages matchs, équipes et joueurs sont publiques et indexables (SEO programmatique). Le dashboard personnalisé et les favoris nécessitent l'authentification.

---

## 3. Schéma de base de données Supabase

### Tables principales

`profiles` (extension de la table users de Supabase Auth) : id (uuid, FK vers auth.users), username, plan (text, default 'free'), created_at, updated_at.

`competitions` : id (int, vient de l'API), name, code, country, current_season, last_updated_at.

`teams` : id (int, vient de l'API), name, short_name, tla (code 3 lettres), country, logo_url, founded, venue, last_updated_at.

`players` : id (int, vient de l'API), name, first_name, last_name, position, nationality, date_of_birth, current_team_id (FK teams), last_updated_at.

`matches` : id (int, vient de l'API), competition_id (FK), home_team_id (FK), away_team_id (FK), kickoff_at (timestamptz), venue, referee, status (scheduled / live / finished), score_home, score_away, half_time_home, half_time_away, matchday, stage, last_updated_at.

`match_lineups` : id, match_id (FK), team_id (FK), player_id (FK), position, shirt_number, is_starter, is_confirmed (false = probable, true = officielle), created_at.

`match_team_stats` : match_id (FK), team_id (FK), possession, shots, shots_on_target, corners, fouls, yellow_cards, red_cards, offsides.

`match_player_stats` : match_id (FK), player_id (FK), minutes_played, goals, assists, shots, passes, key_passes, yellow_card, red_card, rating.

`team_season_stats` : team_id (FK), competition_id (FK), season, played, wins, draws, losses, goals_for, goals_against, goal_difference, points, position, form_last_5 (text array).

`player_season_stats` : player_id (FK), competition_id (FK), season, appearances, minutes, goals, assists, yellow_cards, red_cards.

`match_analyses` : id, match_id (FK), type (pre_match / post_match), content_json (jsonb avec sections : tactique, forme, joueurs clés, prédictions), ai_model, generated_at.

`user_favorites` : user_id (FK profiles), entity_type (team / player / match / competition), entity_id, created_at. Index unique sur (user_id, entity_type, entity_id).

`notification_log` : id, user_id (FK), event_type (lineup_confirmed / kickoff / final_score), match_id (FK), sent_at, email_status.

### Row Level Security

`profiles`, `user_favorites`, `notification_log` : accessibles uniquement par leur propriétaire. Toutes les autres tables (données football) : lecture publique, écriture réservée au service role utilisé par les cron jobs.

---

## 4. Découpage du sprint en 3 phases

### Sprint 1 — Foundation (20 au 26 mai)

Jour 1 (20 mai) : création du repo GitHub, initialisation du projet Next.js avec TypeScript et Tailwind, configuration des variables d'environnement, premier déploiement Vercel vide, achat du nom de domaine.

Jour 2 (21 mai) : création du projet Supabase, écriture des migrations SQL pour toutes les tables, mise en place des Row Level Security policies, connexion Next.js ↔ Supabase via le client officiel.

Jour 3 (22 mai) : implémentation de l'auth (signup, login, logout, reset password) via Supabase Auth UI ou flow custom léger, création automatique de la ligne profiles à l'inscription via trigger SQL.

Jour 4 (23 mai) : développement du client API Football-Data.org avec gestion du rate limit, retry exponentiel, et logging. Mapping des objets API vers le schéma Supabase.

Jour 5 (24 mai) : écriture des 4 cron jobs principaux (refresh hebdo des structures, refresh quotidien des classements, refresh horaire J-1, refresh fin pendant matchs). Test sur les données CDM et Ligue des Champions disponibles.

Jour 6 (25 mai) : layout général de l'app (header avec auth, navigation, footer), thème visuel, première version du dashboard d'accueil avec liste des matchs CDM à venir, design tailwind + shadcn.

Jour 7 (26 mai) : finition du dashboard, gestion des états vide / chargement / erreur, mobile responsive de base, premier déploiement en staging avec données réelles. **Livrable Sprint 1 : un dashboard fonctionnel avec les matchs CDM réels et l'auth opérationnelle.**

### Sprint 2 — Core features (27 mai au 2 juin)

Jour 8 (27 mai) : page fiche match — infos générales, équipes, score, statut. Composant lineup avec les compositions probables ou officielles selon disponibilité.

Jour 9 (28 mai) : suite fiche match — historique des confrontations, formes des deux équipes, stats équipes du match si déjà joué.

Jour 10 (29 mai) : page fiche équipe — stats saison/compétition, forme récente, classement dans la compétition, calendrier à venir, derniers matchs joués.

Jour 11 (30 mai) : page fiche joueur — infos perso, club, stats saison, dernières performances, mini-graphique d'évolution.

Jour 12 (31 mai) : système de favoris — UI bouton "suivre" sur équipes, joueurs et matchs, page `/favoris` listant tout, persistence en base.

Jour 13 (1er juin) : personnalisation du dashboard selon les favoris (priorité aux matchs des équipes favorites, mises en avant joueurs suivis).

Jour 14 (2 juin) : polish UI général, mobile responsive complet, optimisation des images, performance check (Lighthouse > 85). **Livrable Sprint 2 : produit navigable de bout en bout sans l'IA ni les emails.**

### Sprint 3 — IA, notifications et polish (3 au 8 juin)

Jour 15 (3 juin) : conception et test du prompt d'analyse IA pré-match, structure JSON de sortie (sections tactique, forme, joueurs clés, points faibles, prédiction libre), implémentation du pipeline qui se déclenche à l'arrivée de la composition officielle.

Jour 16 (4 juin) : prompt d'analyse IA post-match (faits marquants, homme du match, performances notables, lecture tactique), pipeline déclenché par le passage du match en status `finished`.

Jour 17 (5 juin) : affichage des analyses IA dans les fiches matchs avec un design soigné qui valorise l'aspect "lecture intelligente", gestion du cas où l'analyse n'est pas encore générée.

Jour 18 (6 juin) : intégration Resend, templates email pour les 3 événements (compo officielle, début match, résultat), worker qui détecte les événements et envoie les emails aux users qui ont mis le match ou une des équipes en favoris.

Jour 19 (7 juin) : SEO basique (meta tags par page, sitemap dynamique, robots.txt), Sentry pour le monitoring d'erreurs, tests manuels exhaustifs sur 4-5 matchs de test, fix des bugs critiques.

Jour 20 (8 juin) : buffer pour les bugs imprévus, optimisation finale, vérification de la facture estimée OpenAI à blanc, déploiement de la version finale en production. **Livrable Sprint 3 : produit prêt pour le lancement.**

### Freeze et lancement (9 au 11 juin)

9 et 10 juin : freeze code total. Aucun déploiement. On surveille uniquement la stabilité, on prépare les contenus de pré-lancement (réseaux sociaux, page d'accueil, mentions légales, CGU, politique de confidentialité). On pré-génère les analyses IA pré-match pour les premiers matchs de la CDM dès que les compos officielles sortent.

11 juin : lancement public au coup d'envoi du premier match. Monitoring rapproché toutes les heures pendant 48h.

---

## 5. Estimation des coûts mensuels

### Phase pré-lancement et 0-50 utilisateurs

Vercel hobby gratuit, Supabase free tier gratuit, Football-Data.org free gratuit, Resend gratuit jusqu'à 3000 emails/mois. Seules dépenses : OpenAI environ 5 à 15€ par mois (les analyses IA tournent à 0.02 à 0.05€ par match, 64 matchs CDM + autres compétitions = 50-100 analyses par mois maximum). Nom de domaine environ 1€/mois amorti. **Total : 6 à 16€ par mois.**

### 100 utilisateurs actifs

Vercel hobby toujours suffisant (le free tier inclut 100 GB de bande passante). Supabase free tier OK si la base reste sous 500 MB et 2 GB de bande passante. Football-Data.org free toujours tenable car toutes les requêtes API restent côté serveur via cron, indépendantes du nombre d'utilisateurs. OpenAI environ 20 à 40€ par mois (plus de matchs analysés car on peut élargir au-delà du strict top 5). Resend toujours gratuit. **Total : 25 à 50€ par mois.**

### 1000 utilisateurs actifs

Vercel Pro à 20$ par mois pour la bande passante et les features (analytics, cron jobs avancés). Supabase Pro à 25$ par mois (database plus grosse, plus de connexions concurrentes). Football-Data.org probablement upgrade vers le tier Basic à 12$ par mois pour plus de compétitions. OpenAI environ 80 à 150€ par mois selon le volume de compétitions analysées. Resend Pro à 20$ par mois pour 50 000 emails. Sentry Team à 26$ par mois pour le monitoring. **Total : 180 à 270€ par mois, soit 0.18 à 0.27€ par utilisateur actif et par mois.** À ce stade, l'activation de Stripe avec un plan premium à 4.99€/mois et un taux de conversion réaliste de 3-5% couvrirait largement les coûts.

### Cas catastrophe à anticiper

Si tu obtiens un buzz pendant la CDM et que tu passes à 10 000 utilisateurs en quelques jours, les coûts montent vite. Le plus critique sera la bande passante Vercel et les appels base Supabase. Il faut avoir le plan Pro de Supabase et Vercel sous la main pour upgrader en quelques minutes si nécessaire. Le coût IA reste maîtrisé car les analyses sont mutualisées entre tous les utilisateurs.

---

## 6. Décisions techniques à trancher avant le Sprint 1

### Validées dans nos échanges

API foot : Football-Data.org en free tier. Modèle IA : OpenAI gpt-4o-mini. Hébergement : Vercel + Supabase. Pas de live stats détaillées. Pas de chat IA. Notifications email-only au lancement. Stripe en backend sans paywall actif. Langue : français uniquement au lancement (envisager l'anglais en V2 pour viser un marché plus large).

### Décisions à prendre par toi avant le 20 mai

Le **nom de domaine** : il faut le choisir et l'acheter rapidement (l'enregistrement DNS prend parfois 24-48h). Suggestions à ta convenance : footai.fr, analyse-foot.fr, matchiq.fr, foot-insight.fr, etc.

Le **nom du produit / branding** : doit pouvoir tenir en marque, ne pas évoquer le pari, évoquer l'analyse ou l'intelligence. À choisir en parallèle du domaine.

L'**identité visuelle** : couleurs principales (suggestion : noir ou bleu très foncé en fond + couleur d'accent vive type vert électrique ou orange pour les actions), choix d'une typographie. Tu peux générer un logo simple via une IA d'image si tu n'as pas de designer.

Les **mentions légales et CGU** : il faut les écrire ou les générer (générateurs gratuits en ligne ok pour le MVP) avant le lancement public.

Le **provider d'analytics produit** : Plausible (privacy-friendly, 9$/mois) ou Posthog (free tier généreux, plus complet). Recommandation : Posthog free tier.

### Choses optionnelles que je peux gérer si tu valides

Achat et configuration du domaine. Génération d'un logo simple via DALL-E ou similaire. Rédaction des CGU et mentions légales. Création des templates email avec Resend.

---

## 7. Risques identifiés et plans B

**Risque API foot dépassée** : si Football-Data.org ne couvre pas un match ou un joueur dont tu as besoin, on bascule sur API-Football en backup pour ce cas précis. Garder les deux clés sous la main.

**Risque qualité IA insuffisante** : si gpt-4o-mini produit des analyses trop génériques pour avoir un effet "wow", on switche sur gpt-4o pour les matchs de gala (8e de finale et au-delà). Coût supplémentaire négligeable sur 16 matchs.

**Risque retard sur le sprint** : si à la fin du Sprint 2 (2 juin) on n'a pas les analyses IA fonctionnelles, on lance sans elles le 11 juin et on les pousse en patch dans les 48h. Le produit reste viable.

**Risque charge soudaine pendant la CDM** : avoir les boutons d'upgrade Vercel Pro et Supabase Pro pré-validés dans les comptes, payable en 2 clics si la charge monte.

**Risque RGPD / Conditions** : pas de tracking sans consentement, bandeau cookies minimal mais conforme, pas de stockage de données sensibles utilisateur.

---

## 8. Prochaines étapes immédiates

Cette semaine (avant le 20 mai) : valider ce plan, choisir le nom + domaine, créer les comptes Vercel / Supabase / OpenAI / Resend / GitHub, acheter le domaine. Dès le 20 mai au matin : Sprint 1 démarre, je peux te générer le code de la fondation (setup, schéma SQL, premier déploiement) en quelques heures si on bosse ensemble.
