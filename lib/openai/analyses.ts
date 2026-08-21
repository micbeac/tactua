// Génération d'analyses pré/post-match via OpenAI.
// Deep pre-match → modèle premium (DEEP_MODEL) ; reste → gpt-4o-mini.
// Sortie strictement typée via response_format json_schema.

import {
  DEEP_MODEL,
  DEFAULT_MODEL,
  getOpenAI,
  isReasoningModel,
} from './client.ts';
import {
  DEEP_PRE_MATCH_JSON_SCHEMA,
  POST_MATCH_JSON_SCHEMA,
  PRE_MATCH_JSON_SCHEMA,
  type DeepPreMatchAnalysis,
  type PostMatchAnalysis,
  type PreMatchAnalysis,
  type TeamSide,
} from './types.ts';

export type FormResult = 'W' | 'D' | 'L';

export type TeamContext = {
  name: string;
  country: string | null;
  recent_form: FormResult[]; // 5 derniers résultats
  /** Liste des XI titulaires (si compo officielle dispo, sinon vide). */
  starting_eleven: string[];
};

export type H2HContext = {
  date: string; // YYYY-MM-DD
  home_team: string;
  away_team: string;
  score_home: number | null;
  score_away: number | null;
};

export type PreMatchContext = {
  competition: string;
  stage_or_matchday: string | null; // ex "Group Stage", "Journée 38"
  kickoff_at_iso: string;
  venue: string | null;
  home: TeamContext;
  away: TeamContext;
  head_to_head: H2HContext[]; // jusqu'à 5
};

const SYSTEM_PROMPT = `Tu es un analyste football francophone pour Tactuo, une webapp d'analyse augmentée par l'IA.
Tu écris pour des fans curieux qui veulent comprendre le match avant le coup d'envoi : tactique, forme, joueurs clés, points faibles.

Règles :
- Français exclusivement. Ton factuel mais engageant. Pas de jargon inutile.
- Reste concis : chaque champ texte fait 1 à 3 phrases max.
- Base-toi UNIQUEMENT sur le contexte fourni (formes, compositions, H2H). Pas d'invention de stats.
- Si tu n'as pas d'info pour un champ, dis-le sobrement (ex : "Composition non encore publiée").
- Pour la prédiction : tu peux assumer un favori et une confiance, mais accompagne le chiffre de son incertitude. Aucun conseil de mise. Le scoreline_guess doit être un score plausible (ex "1-1", "2-0 dom.", "0-1 ext.").`;

function buildUserPrompt(ctx: PreMatchContext): string {
  const fmtForm = (form: FormResult[]) =>
    form.length === 0 ? 'inconnue' : form.join('-');
  const fmtSquad = (squad: string[]) =>
    squad.length === 0 ? 'non publiée' : squad.join(', ');

  const h2hLines =
    ctx.head_to_head.length === 0
      ? 'Aucune confrontation passée enregistrée.'
      : ctx.head_to_head
          .map(
            (h) =>
              `- ${h.date} : ${h.home_team} ${h.score_home ?? '?'}-${h.score_away ?? '?'} ${h.away_team}`,
          )
          .join('\n');

  return `Contexte du match à venir :

Compétition : ${ctx.competition}${ctx.stage_or_matchday ? ` (${ctx.stage_or_matchday})` : ''}
Coup d'envoi : ${ctx.kickoff_at_iso}${ctx.venue ? ` — ${ctx.venue}` : ''}

Équipe à domicile : ${ctx.home.name}${ctx.home.country ? ` (${ctx.home.country})` : ''}
- Forme récente (5 derniers, du + récent au + ancien) : ${fmtForm(ctx.home.recent_form)}
- XI titulaire : ${fmtSquad(ctx.home.starting_eleven)}

Équipe à l'extérieur : ${ctx.away.name}${ctx.away.country ? ` (${ctx.away.country})` : ''}
- Forme récente : ${fmtForm(ctx.away.recent_form)}
- XI titulaire : ${fmtSquad(ctx.away.starting_eleven)}

Confrontations directes récentes :
${h2hLines}

Génère l'analyse pré-match en JSON selon le schéma fourni.`;
}

export async function generatePreMatchAnalysis(
  ctx: PreMatchContext,
  options: { model?: string } = {},
): Promise<{
  analysis: PreMatchAnalysis;
  model: string;
  usage: { input: number; output: number };
}> {
  const model = options.model ?? DEFAULT_MODEL;
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ctx) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'pre_match_analysis',
        strict: true,
        // Le SDK exige `Record<string, unknown>`; on cast le const-tuple ici.
        schema: PRE_MATCH_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI a renvoyé une réponse vide.');
  }
  const analysis = JSON.parse(content) as PreMatchAnalysis;

  return {
    analysis,
    model,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}

/** Petit helper exporté pour la lisibilité côté UI. */
export function teamSideLabel(side: TeamSide): string {
  return side === 'home' ? 'Domicile' : 'Extérieur';
}

// ============================================================================
// DEEP PRE-MATCH (avec stats détaillées via API-Football)
// ============================================================================

export type DeepTeamContext = {
  name: string;
  country: string | null;
  // Stats globales saison
  form_long: string; // ex "LWLWDWWDDWWWLDLDLLDWLLLLWWWLWLWWLLDWW"
  played: { home: number; away: number; total: number };
  wins: { home: number; away: number; total: number };
  draws: { home: number; away: number; total: number };
  loses: { home: number; away: number; total: number };
  goals_for_avg: { home: string; away: string; total: string };
  goals_against_avg: { home: string; away: string; total: string };
  clean_sheets: number;
  failed_to_score: number;
  biggest_streak: { wins: number; loses: number };
  primary_formation: string | null;
  // Joueurs : top performers avec stats enrichies
  top_performers: Array<{
    af_player_id: number; // pour link DB
    photo: string | null;
    name: string;
    position: string | null;
    is_captain: boolean;
    lineups: number;
    minutes: number;
    goals: number;
    assists: number;
    rating: number | null;
    shots_on_target: number | null;
    key_passes: number | null;
    passes_accuracy: number | null;
    duels_won_ratio: number | null;
    // Gardien (null sinon)
    saves: number | null;
    goals_conceded: number | null;
  }>;
  // Indisponibles (kind : 'suspension' | 'injury' | 'other')
  active_injuries: Array<{
    player_name: string;
    reason: string | null;
    kind: 'suspension' | 'injury' | 'other';
  }>;
  /**
   * Joueurs à un carton jaune du seuil de suspension.
   *
   * Une absence probable au match SUIVANT en cas d'avertissement, qui pèse
   * sur la gestion du match en cours : un cadre sous menace prend moins de
   * risques, ou se fait ménager.
   */
  suspension_risks?: Array<{
    player_name: string;
    yellow_cards: number;
    threshold: number;
  }>;
  /** Entraîneur principal (nom + nationalité). Facultatif. */
  coach?: { name: string; nationality: string | null } | null;
  // XI titulaire si dispo (sinon vide)
  starting_eleven: string[];
  /** Joueurs qui ont joué pour cette équipe cette saison mais sont
   *  partis au mercato. L'IA doit explicitement NE PAS les mentionner. */
  transferred_out?: string[];
  /** Jours de repos depuis le dernier match (fraîcheur) */
  rest_days?: number | null;
  /** Matchs joués sur les 14 derniers jours (congestion calendaire) */
  matches_last_14d?: number;
  /** Position au classement + écarts avec les voisins directs */
  standing?: {
    position: number;
    points: number;
    total_teams: number;
    points_behind_above: number | null;
    points_ahead_below: number | null;
  } | null;
  /**
   * Ventilation complète des buts par tranche de 15 minutes.
   *
   * L'API renvoie ce détail depuis toujours ; on n'en extrayait que deux
   * pourcentages (avant la 15e, après la 75e) et le reste était jeté.
   * La courbe entière dit bien plus : une équipe qui encaisse surtout
   * entre la 60e et la 75e a un problème de gestion de l'effort, pas de
   * défense.
   *
   * `null` tant que l'échantillon est trop faible — voir
   * MIN_GOALS_FOR_TIMING.
   */
  goal_distribution?: {
    scored: Array<{ bucket: string; total: number; pct: number }>;
    conceded: Array<{ bucket: string; total: number; pct: number }>;
  } | null;
  /** Part des buts marqués sur penalty, en %. */
  penalty_share_pct?: number | null;
  /** Répartition temporelle des buts (% marqués/encaissés tôt vs tard) */
  goal_timing?: {
    scored_early_pct: number | null; // 0-15'
    scored_late_pct: number | null; // 76' →
    conceded_early_pct: number | null;
    conceded_late_pct: number | null;
  } | null;
  /** xG saison : buts attendus marqués/concédés par match (moyenne) */
  season_xg?: {
    sample: number;
    xg_for_avg: number;
    xg_against_avg: number;
  } | null;
  /**
   * Bilan de la saison PRÉCÉDENTE, terminée.
   *
   * Renseigné uniquement en début de saison, quand la saison en cours compte
   * trop peu de matchs pour dire quoi que ce soit : sur 2 journées, « 2
   * victoires, 3 buts/match » n'a aucune valeur prédictive. Sans ce repli,
   * l'analyse d'un match de la 3ᵉ journée est forcément indigente.
   */
  /**
   * Les derniers matchs joués, avec adversaire et score.
   *
   * `form_long` ne donne que « WWDLW » : battre le leader ou la lanterne
   * rouge y produit le même caractère. Sans le détail, l'analyse ne peut pas
   * juger la VALEUR des résultats récents — c'est ce qui distingue une
   * lecture professionnelle d'un récit générique.
   */
  recent_fixtures?: Array<{
    date: string;
    competition: string;
    opponent: string;
    at_home: boolean;
    goals_for: number;
    goals_against: number;
    result: 'W' | 'D' | 'L';
    opponent_af_id?: number;
    /**
     * Position de l'adversaire au classement au moment de la lecture.
     * Battre le 18e et battre le 2e ne disent pas la même chose, et une
     * séquence VVV contre le bas de tableau ne vaut pas une série de nuls
     * contre le haut.
     */
    opponent_position?: number | null;
  }>;
  /** Discipline : cartons cumulés sur la saison. */
  discipline?: { yellow: number; red: number } | null;
  /** Penalties obtenus et convertis sur la saison. */
  penalties?: { scored: number; missed: number; total: number } | null;
  previous_season?: {
    label: string;
    played: number;
    wins: number;
    draws: number;
    loses: number;
    goals_for_avg: string;
    goals_against_avg: string;
    clean_sheets: number;
    form_tail: string;
    /** Forme complète de la saison passée, pour alimenter l’affichage. */
    form_long: string;
    /** Formation la plus utilisée la saison passée. */
    primary_formation: string | null;
    goals_for_total: number;
    goals_against_total: number;
    failed_to_score: number;
    biggest_win_streak: number;
  } | null;
};

export type RecentNarrative = {
  title: string;
  snippet: string;
};

export type DeepPreMatchContext = {
  competition: string;
  stage_or_matchday: string | null;
  kickoff_at_iso: string;
  venue: string | null;
  home: DeepTeamContext;
  away: DeepTeamContext;
  head_to_head: Array<{
    date: string;
    home_team: string;
    away_team: string;
    score_home: number | null;
    score_away: number | null;
  }>;
  /**
   * Bilan agrégé des confrontations directes.
   *
   * La liste des 10 derniers matchs est déjà fournie, mais laisser le
   * modèle la compter lui-même est une source d'erreurs. On lui donne
   * directement les totaux, et surtout le bilan LORSQUE CETTE ÉQUIPE
   * REÇOIT, qui est la seule lecture pertinente pour ce match-ci.
   */
  h2h_summary?: {
    total: number;
    home_wins: number;
    draws: number;
    away_wins: number;
    avg_goals: number;
    btts_pct: number;
    over_2_5_pct: number;
    at_home_venue: {
      total: number;
      home_wins: number;
      draws: number;
      away_wins: number;
    } | null;
  } | null;
  /** Arbitre désigné, si connu. */
  referee?: string | null;
  /** Narratifs récents par équipe (news scrapées via Apify). Facultatif. */
  recent_narratives?: {
    home: RecentNarrative[];
    away: RecentNarrative[];
  };
  /**
   * Consensus de probabilités issu de données de marché agrégées.
   *
   * Citable dans le texte sous le nom « consensus des marchés » depuis
   * l'élargissement de la ligne éditoriale (20/08/2026). L'écart entre
   * cette probabilité et celle du modèle est justement ce qui a le plus
   * de valeur pour le lecteur. Restent interdits : la cote décimale brute,
   * le nom d'un bookmaker, et tout conseil de mise.
   */
  market_consensus?: {
    source_count: number;
    match_winner: {
      home_pct: number;
      draw_pct: number;
      away_pct: number;
    } | null;
    btts_yes_pct: number | null;
    over_2_5_pct: number | null;
  };
  /**
   * Comparaison domicile/extérieur du modèle statistique API-Football
   * (chaque dimension = poids home vs away en %). Signal de calibrage.
   */
  af_prediction?: {
    form: { home: number; away: number };
    attack: { home: number; away: number };
    defense: { home: number; away: number };
    poisson: { home: number; away: number };
    h2h: { home: number; away: number };
    goals: { home: number; away: number };
    overall: { home: number; away: number };
    /** Probabilités propres du modèle tiers : 3e avis indépendant. */
    percent: { home: number; draw: number; away: number } | null;
    last_5: {
      home: { played: number; form: number; attack: number; defense: number } | null;
      away: { played: number; form: number; attack: number; defense: number } | null;
    };
  };
};

const DEEP_SYSTEM_PROMPT = `Tu es un analyste football francophone pour Tactuo, une webapp d'analyse augmentée par l'IA.
Tu rédiges une analyse pré-match approfondie en t'appuyant sur des STATISTIQUES DÉTAILLÉES.

Règles :
- Français exclusivement. Ton factuel, fondé sur les chiffres fournis. Aucune invention.
- Tu DOIS citer des chiffres précis dans tes paragraphes (ex : "Bologne marque 1,6 but/match à l'extérieur", "Inter a 12 clean sheets cette saison", "ratio victoires à domicile : X/Y").
- "data_insight" : 2-3 phrases qui synthétisent ce que les chiffres révèlent du match à venir (mismatch tactique, déséquilibre dom/ext, joueur clé absent, série en cours…).
- "tactical_overview.key_battles" : exactement 2 ou 3 confrontations clés qui décideront le match, réparties sur le terrain (ex : un pressing contre une relance, une attaque contre une charnière, un duel d'ailes). Chaque entrée : "title" = la confrontation en 4-8 mots ; "detail" = 2-3 phrases concrètes sur pourquoi elle est décisive, en citant des chiffres et des joueurs réels fournis.
- "x_factor" : LE facteur qui peut faire basculer le match — souvent non-évident (un retour de blessure, une fragilité sur coups de pied arrêtés, une fatigue de calendrier, un cadre suspendu, un mismatch de fraîcheur). "title" = le facteur en quelques mots ; "detail" = 2-3 phrases expliquant son impact possible. Un seul facteur, le plus déterminant.
- "things_to_watch" : exactement 3 points concrets à observer EN REGARDANT le match, orientés spectateur ("Surveiller si X presse haut dès l'entame", "Le côté gauche de Y, exploité 60% du temps"…). Chaque point = une phrase actionnable, pas une généralité.
- "scenarios" : exactement 3 scénarios narratifs du match, ORDONNÉS du plus probable au moins probable. Chacun :
  * "title" : 4-8 mots qui résument le scénario (ex : "Domination Inter, but tardif des visiteurs", "Match fermé décidé sur coup de pied arrêté").
  * "narrative" : 3-4 phrases qui racontent comment le match se déroule dans CE scénario — phases de jeu, joueurs impliqués, moments clés, score final implicite. Cite des chiffres précis (ex : "Profitant des 1,8 buts/match marqués à domicile…").
  * "likelihood" : "élevée" (scénario #1, le plus probable), "moyenne" (scénario #2, alternatif crédible), "faible" (scénario #3, retournement possible).
  Les 3 scénarios doivent être DIFFÉRENTS dans leur déroulé et leur issue (pas 3 variantes du même scénario).
- "prediction.probabilities" : pourcentages cohérents qui somment à 100. Base tes probas sur :
  * V/N/D historiques de chaque équipe (split home/away)
  * forme récente (longue série fournie, regarde les 10 derniers caractères)
  * H2H récent
  * impact des indisponibilités
- "prediction.btts" : "yes" si les 2 équipes marquent plus de 60% du temps en moyenne, sinon "no". Justifie en citant les chiffres "failed_to_score" et "clean_sheets".
- "prediction.over_2_5" : "yes" si la moyenne combinée des buts pour des 2 équipes > 2.5. Justifie.
- "prediction.scoreline_guess" : score plausible cohérent avec les probas et les moyennes de buts (ex "1-1", "2-1", "0-2").
- "prediction.confidence" : "high" si les indicateurs convergent, "medium" si mixtes, "low" si chaos.
- ACTU RÉCENTE — Si une section "Actu récente" est fournie pour une ou les deux équipes :
  * Tu DOIS citer EXPLICITEMENT au moins 2 éléments d'actualité dans ton analyse, en les paraphrasant fidèlement (pas de copier-coller, pas d'invention).
  * Place ces références prioritairement dans "data_insight" (1-2 éléments) et dans "tactical_overview.home_approach" ou "away_approach" ou dans la "form_assessment" (1-2 éléments).
  * Exemples typiques d'usage : "L'élimination récente en Ligue Europa face à Aston Villa pèse sur le moral", "La rumeur du transfert de Bastoni à Barcelone crée une distraction en interne", "L'incertitude autour des internationaux français Bleus de l'Inter…"
  * Si l'actu mentionne des matchs récents perdus/gagnés, intègre-les dans la lecture de la forme ("La défaite en Ligue Europa s'ajoute aux X défaites de la série…").
  * Si l'actu n'est PAS pertinente pour ce match précis, ignore-la — mais évite ce cas autant que possible, il y a toujours un angle.

- RÈGLE CRITIQUE — INTÉGRITÉ DES JOUEURS :
  * Tu ne peux mentionner QUE des joueurs présents dans "Top performers" OU "XI titulaire annoncé" OU "Indisponibles" pour leur équipe respective.
  * Si une ligne "⚠ NE PAS MENTIONNER" est fournie pour une équipe, ces joueurs sont PARTIS AU MERCATO et ne jouent plus pour cette équipe. Tu ne dois JAMAIS les citer comme acteurs du match à venir.
  * N'invente AUCUN nom de joueur, même si tu penses connaître l'effectif. Tes connaissances peuvent être dépassées par rapport au mercato.
  * En cas de doute sur un joueur, utilise un terme générique ("l'attaquant", "le milieu créatif", "la défense").

- CONTEXTE DE MATCH — Exploite ces signaux quand ils sont fournis :
  * "Classement" : intègre l'enjeu réel (course au titre, places européennes, maintien, match sans enjeu). Un écart de points serré près d'une zone clé augmente l'intensité attendue.
  * "Fraîcheur" : un faible nombre de jours de repos ou une forte densité de calendrier (3+ matchs/14 j) annonce de la fatigue, des rotations possibles, une baisse de régime en 2e période. Compare les deux équipes.
  * "Tempo des buts" : exploite-le dans les scénarios (ex : une équipe qui marque tard + une qui encaisse tard → "but décisif dans le dernier quart d'heure" crédible).
  * "xG saison" : compare le xG aux buts réellement marqués/encaissés (champs "Buts marqués/encaissés / match"). Un xG marqué supérieur aux buts réels = équipe qui sous-performe sa finition (va probablement se corriger à la hausse) ; un xG concédé inférieur aux buts encaissés = défense chanceuse. C'est un signal FORT de la vraie valeur d'une équipe — utilise-le pour nuancer la lecture des résultats bruts et calibrer "prediction".
  * "Entraîneur" : tu peux le citer pour parler du style/de l'approche tactique de l'équipe.
  * Indisponibles : distingue bien SUSPENDU (manque mécaniquement, certain) de blessé (incertain). Un cadre suspendu est une absence sûre à intégrer.
  * "Saison précédente" : ce bloc n'apparaît qu'en DÉBUT DE SAISON, quand la saison en cours compte trop peu de matchs pour être significative. Dans ce cas :
    - Appuie-toi dessus pour établir le NIVEAU des équipes (hiérarchie, puissance offensive, solidité défensive) — c'est ta principale matière chiffrée.
    - Nomme toujours la saison quand tu cites ces chiffres ("la saison dernière", "en 2025-26"). Ne les présente JAMAIS comme la forme du moment.
    - Dis explicitement que l'échantillon de la saison en cours est encore mince, au lieu de tirer des conclusions de 2 ou 3 matchs.
    - Prends en compte que les effectifs ont pu changer au mercato : le niveau passé est un repère, pas une garantie.
  * "Derniers matchs" : c'est ta matière la plus concrète. Une chaîne "WWDLW" ne dit pas CONTRE QUI ; ici tu as l'adversaire, le lieu et le score exact.
    - Cite ces résultats nommément dans "form_assessment" et "data_insight" ("battu 3-0 à Bilbao", "tenu en échec par le promu").
    - Pondère la valeur des résultats : une victoire contre le dernier ne vaut pas une victoire chez le leader. Une défaite en coupe d'Europe trois jours avant explique souvent une contre-performance.
    - Repère les dynamiques réelles (série de clean sheets, attaque en panne, matchs à répétition à l'extérieur) plutôt que de paraphraser la suite de lettres.
  * "Discipline" : un total de cartons élevé annonce un match haché, un risque de suspension ou d'infériorité numérique — angle utile pour "x_factor" ou "things_to_watch". Le ratio de penalties convertis éclaire l'efficacité sur coups de pied arrêtés.
- VENTILATION DES BUTS — La répartition par tranche de 15 minutes est fournie pour les buts marqués ET encaissés. Cherche-y un motif exploitable : un pic d'encaissement entre la 60e et la 75e trahit une gestion de l'effort, un pic de buts marqués en fin de match une équipe qui finit fort. Croise les deux équipes (l'une marque tard, l'autre encaisse tard = scénario crédible) et sers-t'en dans "scenarios" et "things_to_watch". Ne parle JAMAIS de but sur corner ou coup franc : cette information n'est pas dans les données, seule la part des penaltys est connue.
- QUALITÉ DE L'ADVERSAIRE — Quand la position d'un adversaire est indiquée entre crochets dans les derniers matchs, pondère la forme avec : trois victoires contre le bas de tableau ne valent pas une série de nuls contre le haut. Dis-le explicitement dans "form_assessment" quand l'écart de calibre est net.
- MENACE DE SUSPENSION — Si des joueurs sont signalés sous menace, c'est un angle concret et rarement traité ailleurs. Un cadre à un carton du seuil joue plus prudemment, peut être ménagé, ou manquera la journée suivante. Utilise-le dans "x_factor" ou "things_to_watch", jamais comme une absence pour CE match : le joueur est bien disponible aujourd'hui.
- CONFRONTATIONS DIRECTES — Un bilan agrégé est fourni sous la liste des matchs. Sers-t'en plutôt que de recompter, et privilégie le bilan « quand cette équipe reçoit » : une domination à l'extérieur ne se transpose pas à domicile. Un historique déséquilibré est un angle fort, mais rappelle qu'il porte sur des effectifs et des entraîneurs qui ont pu changer.
- ARBITRE — Si un arbitre est nommé, tu peux le citer comme élément de contexte. N'invente aucune statistique à son sujet : sans chiffres fournis, contente-toi de le nommer.
- MODÈLE STATISTIQUE TIERS — Si un bloc "Modèle statistique tiers" est fourni : c'est un modèle externe, indépendant du nôtre et du consensus des marchés. Tu disposes donc de TROIS estimations. Croise-les pour calibrer "prediction" et pour régler "prediction.confidence" : trois sources convergentes justifient "high", trois sources qui divergent imposent "medium" ou "low". Si l'écart entre le modèle tiers et le marché est net, c'est en soi un signal — dis-le dans "data_insight". Ne le nomme jamais (donnée interne) : parle d'« un modèle statistique indépendant ».
- CONSENSUS DES MARCHÉS — Si un bloc "Consensus probabiliste" est fourni :
  * C'est une probabilité agrégée issue des marchés, la référence la plus fiable dont tu disposes pour calibrer tes prédictions.
  * Utilise-la pour ajuster "prediction.probabilities", "prediction.btts" et "prediction.over_2_5" — pondère-la avec ta propre lecture statistique (ne la recopie pas aveuglément, mais ne t'en éloigne pas sans raison chiffrée).
  * Tu PEUX la citer dans le texte, sous le nom "consensus des marchés" ou "probabilités de marché". Exemples autorisés : "le marché voit les visiteurs favoris à 58 %", "notre lecture est nettement plus favorable au nul que le consensus".
  * ⚠ ÉCART MODÈLE / MARCHÉ — c'est le point le plus utile au lecteur. Dès que ta probabilité s'écarte de plus de 10 points du consensus sur une issue, dis-le explicitement dans "data_insight" et justifie l'écart par des chiffres.
  * Ne cite jamais une cote décimale brute ni un nom de bookmaker : tu ne disposes que de probabilités agrégées, pas d'une offre commerciale.
  * INTERDIT en toutes circonstances : conseiller une mise, un montant, une bankroll ou un pari à jouer. Tu éclaires une décision, tu ne la prends pas.

Tu peux employer le vocabulaire du pronostic — favori, outsider, confiance — et assumer tes probabilités.
Accompagne toujours un chiffre de son incertitude : un favori à 60 % perd 4 fois sur 10.
Aucune promesse de gain, aucun conseil de mise.`;

function fmtSquad(squad: string[]): string {
  return squad.length === 0 ? 'non publiée' : squad.join(', ');
}

function fmtTop(performers: DeepTeamContext['top_performers']): string {
  if (performers.length === 0) return 'données non disponibles';
  return performers
    .map((p) => {
      const parts = [`${p.name}`];
      if (p.is_captain) parts.push('(C)');
      if (p.position) parts.push(`[${p.position}]`);
      const stats: string[] = [];
      stats.push(`${p.lineups} titu/${p.minutes}min`);
      if (p.goals || p.assists) stats.push(`${p.goals}b/${p.assists}a`);
      if (p.rating) stats.push(`note ${p.rating}`);
      if (p.shots_on_target != null)
        stats.push(`${p.shots_on_target} tirs cadrés`);
      if (p.key_passes != null) stats.push(`${p.key_passes} passes clés`);
      if (p.passes_accuracy != null)
        stats.push(`${Math.round(p.passes_accuracy)}% passes`);
      if (p.duels_won_ratio != null)
        stats.push(`${Math.round(p.duels_won_ratio * 100)}% duels gagnés`);
      if (p.saves != null) stats.push(`${p.saves} arrêts (G)`);
      if (p.goals_conceded != null) stats.push(`${p.goals_conceded} buts enc.`);
      return `${parts.join(' ')} — ${stats.join(', ')}`;
    })
    .join('\n  • ');
}

function fmtInjuries(list: DeepTeamContext['active_injuries']): string {
  if (list.length === 0) return 'aucune indispo connue';
  return list
    .map((i) => {
      const tag =
        i.kind === 'suspension'
          ? 'SUSPENDU'
          : i.kind === 'injury'
            ? 'blessé'
            : 'indispo';
      return `${i.player_name} (${tag}${i.reason ? ` — ${i.reason}` : ''})`;
    })
    .join(' · ');
}

function fmtCoach(t: DeepTeamContext): string {
  if (!t.coach) return '';
  const nat = t.coach.nationality ? ` (${t.coach.nationality})` : '';
  return `\n- Entraîneur : ${t.coach.name}${nat}`;
}

function fmtStanding(t: DeepTeamContext): string {
  if (!t.standing) return '';
  const s = t.standing;
  const above =
    s.points_behind_above != null
      ? `, à ${s.points_behind_above} pt(s) du rang au-dessus`
      : '';
  const below =
    s.points_ahead_below != null
      ? `, ${s.points_ahead_below} pt(s) d'avance sur le rang en-dessous`
      : '';
  return `\n- Classement : ${s.position}ᵉ/${s.total_teams} (${s.points} pts)${above}${below}`;
}

function fmtFreshness(t: DeepTeamContext): string {
  if (t.rest_days == null && t.matches_last_14d == null) return '';
  const rest =
    t.rest_days != null ? `${t.rest_days} j de repos` : 'repos inconnu';
  const dens =
    t.matches_last_14d != null
      ? `, ${t.matches_last_14d} match(s) sur 14 j`
      : '';
  return `\n- Fraîcheur : ${rest}${dens}`;
}

function fmtXG(t: DeepTeamContext): string {
  const x = t.season_xg;
  if (!x || x.sample === 0) return '';
  return `\n- xG saison (sur ${x.sample} matchs) : ${x.xg_for_avg} xG marqué/match, ${x.xg_against_avg} xG concédé/match`;
}

function fmtGoalTiming(t: DeepTeamContext): string {
  const g = t.goal_timing;
  if (
    !g ||
    (g.scored_late_pct == null &&
      g.conceded_late_pct == null &&
      g.scored_early_pct == null &&
      g.conceded_early_pct == null)
  ) {
    return '';
  }
  const parts: string[] = [];
  if (g.scored_late_pct != null)
    parts.push(`${g.scored_late_pct}% de ses buts marqués après la 75ᵉ`);
  if (g.conceded_late_pct != null)
    parts.push(`${g.conceded_late_pct}% encaissés après la 75ᵉ`);
  if (g.scored_early_pct != null)
    parts.push(`${g.scored_early_pct}% marqués avant la 15ᵉ`);
  return parts.length > 0 ? `\n- Tempo des buts : ${parts.join(', ')}` : '';
}

function fmtPreviousSeason(t: DeepTeamContext): string {
  const p = t.previous_season;
  if (!p) return '';
  return (
    `\n- Saison précédente (${p.label}, TERMINÉE — repère de niveau, pas de forme actuelle) : ` +
    `${p.wins}V ${p.draws}N ${p.loses}D sur ${p.played} matchs, ` +
    `${p.goals_for_avg} but(s) marqué(s) et ${p.goals_against_avg} encaissé(s) par match, ` +
    `${p.clean_sheets} clean sheets` +
    (p.form_tail ? `, fin de saison : ${p.form_tail}` : '')
  );
}

function fmtRecentFixtures(t: DeepTeamContext): string {
  const list = t.recent_fixtures;
  if (!list || list.length === 0) return '';
  const lines = list
    .map((f) => {
      const where = f.at_home ? 'dom.' : 'ext.';
      const res = f.result === 'W' ? 'V' : f.result === 'L' ? 'D' : 'N';
      const rank = f.opponent_position ? ` [${f.opponent_position}e]` : '';
      return `    · ${f.date.slice(5)} ${f.competition}, ${where} vs ${f.opponent}${rank} : ${f.goals_for}-${f.goals_against} (${res})`;
    })
    .join(String.fromCharCode(10));
  return `
- Derniers matchs (ordre chronologique, toutes compétitions) :
${lines}`;
}

function fmtDiscipline(t: DeepTeamContext): string {
  const parts: string[] = [];
  if (t.discipline) {
    parts.push(
      `${t.discipline.yellow} carton(s) jaune(s), ${t.discipline.red} rouge(s)`,
    );
  }
  if (t.penalties) {
    parts.push(
      `penalties : ${t.penalties.scored}/${t.penalties.total} convertis`,
    );
  }
  return parts.length > 0 ? `
- Discipline : ${parts.join(' · ')}` : '';
}

function fmtGoalDistribution(t: DeepTeamContext): string {
  const d = t.goal_distribution;
  const parts: string[] = [];
  if (d) {
    const line = (rows: typeof d.scored) =>
      rows
        .filter((r) => r.total > 0)
        .map((r) => `${r.bucket}′ ${r.total} (${r.pct}%)`)
        .join(', ');
    parts.push(`buts marqués par tranche : ${line(d.scored)}`);
    parts.push(`buts encaissés par tranche : ${line(d.conceded)}`);
  }
  if (t.penalty_share_pct != null) {
    parts.push(`${t.penalty_share_pct} % des buts viennent d’un penalty`);
  }
  return parts.length > 0 ? `
- Ventilation des buts : ${parts.join(' ; ')}` : '';
}

function fmtSuspensionRisks(t: DeepTeamContext): string {
  const list = t.suspension_risks;
  if (!list || list.length === 0) return '';
  const names = list
    .map((s) => `${s.player_name} (${s.yellow_cards}/${s.threshold})`)
    .join(', ');
  return `
- ⚠ Sous menace de suspension (un jaune de plus = match suivant manqué) : ${names}`;
}

function fmtH2HSummary(ctx: DeepPreMatchContext): string {
  const s = ctx.h2h_summary;
  if (!s || s.total === 0) return '';
  const parts = [
    `Bilan sur ${s.total} confrontations : ${s.home_wins} victoire(s) ${ctx.home.name}, ${s.draws} nul(s), ${s.away_wins} victoire(s) ${ctx.away.name}`,
    `${s.avg_goals} but(s) par match en moyenne`,
    `les deux équipes ont marqué dans ${s.btts_pct} % des cas`,
    `${s.over_2_5_pct} % de ces matchs ont dépassé 2,5 buts`,
  ];
  if (s.at_home_venue && s.at_home_venue.total > 0) {
    const v = s.at_home_venue;
    parts.push(
      `quand ${ctx.home.name} reçoit : ${v.home_wins}V ${v.draws}N ${v.away_wins}D sur ${v.total} match(s)`,
    );
  }
  return `
${parts.join('. ')}.`;
}

function fmtReferee(ctx: DeepPreMatchContext): string {
  return ctx.referee ? `
Arbitre désigné : ${ctx.referee}` : '';
}

function buildDeepPrompt(ctx: DeepPreMatchContext): string {
  const fmtTeam = (t: DeepTeamContext, side: 'Domicile' | 'Extérieur') =>
    `
[${side}] ${t.name}${t.country ? ` (${t.country})` : ''}
- Forme longue (W/D/L, du + ancien au + récent) : ${t.form_long}
- Bilan total : ${t.wins.total}V ${t.draws.total}N ${t.loses.total}D sur ${t.played.total} matchs
- À domicile : ${t.wins.home}V ${t.draws.home}N ${t.loses.home}D sur ${t.played.home} matchs
- À l'extérieur : ${t.wins.away}V ${t.draws.away}N ${t.loses.away}D sur ${t.played.away} matchs
- Buts marqués / match : home ${t.goals_for_avg.home}, away ${t.goals_for_avg.away}, total ${t.goals_for_avg.total}
- Buts encaissés / match : home ${t.goals_against_avg.home}, away ${t.goals_against_avg.away}, total ${t.goals_against_avg.total}
- Clean sheets : ${t.clean_sheets} / Failed to score : ${t.failed_to_score}
- Meilleure série victoires : ${t.biggest_streak.wins} / Pire série défaites : ${t.biggest_streak.loses}
- Formation principale : ${t.primary_formation ?? '—'}${fmtCoach(t)}${fmtStanding(t)}${fmtFreshness(t)}${fmtXG(t)}${fmtGoalTiming(t)}${fmtGoalDistribution(t)}${fmtPreviousSeason(t)}
- Top performers : ${fmtTop(t.top_performers)}
- Indisponibles récents : ${fmtInjuries(t.active_injuries)}${fmtSuspensionRisks(t)}
- XI titulaire annoncé : ${fmtSquad(t.starting_eleven)}${fmtDiscipline(t)}${fmtRecentFixtures(t)}${
    t.transferred_out && t.transferred_out.length > 0
      ? `\n- ⚠ NE PAS MENTIONNER (partis au mercato, ne jouent plus pour cette équipe) : ${t.transferred_out.join(', ')}`
      : ''
  }`.trim();

  const h2hLines =
    ctx.head_to_head.length === 0
      ? 'Aucune confrontation passée enregistrée.'
      : ctx.head_to_head
          .map(
            (h) =>
              `- ${h.date} : ${h.home_team} ${h.score_home ?? '?'}-${h.score_away ?? '?'} ${h.away_team}`,
          )
          .join('\n');

  const fmtNarratives = (
    list: RecentNarrative[] | undefined,
    teamName: string,
  ) => {
    if (!list || list.length === 0) return '';
    const lines = list
      .slice(0, 5)
      .map((n) => `  - "${n.title.trim()}" → ${n.snippet.trim()}`)
      .join('\n');
    return `\nActu récente ${teamName} :\n${lines}`;
  };

  const narratives = ctx.recent_narratives
    ? fmtNarratives(ctx.recent_narratives.home, ctx.home.name) +
      fmtNarratives(ctx.recent_narratives.away, ctx.away.name)
    : '';

  // Bloc consensus de marché (interne, calibrage uniquement)
  let consensusBlock = '';
  const mc = ctx.market_consensus;
  if (mc) {
    const lines: string[] = [];
    if (mc.match_winner) {
      lines.push(
        `- Issue : victoire ${ctx.home.name} ${mc.match_winner.home_pct}% · nul ${mc.match_winner.draw_pct}% · victoire ${ctx.away.name} ${mc.match_winner.away_pct}%`,
      );
    }
    if (mc.btts_yes_pct != null) {
      lines.push(`- Les deux équipes marquent : ${mc.btts_yes_pct}%`);
    }
    if (mc.over_2_5_pct != null) {
      lines.push(`- Plus de 2,5 buts : ${mc.over_2_5_pct}%`);
    }
    if (lines.length > 0) {
      consensusBlock = `\nConsensus probabiliste (${mc.source_count} sources agrégées — donnée interne de calibrage) :\n${lines.join('\n')}\n`;
    }
  }

  // Bloc prédiction statistique AF (interne, calibrage)
  let afPredBlock = '';
  const ap = ctx.af_prediction;
  if (ap) {
    const h = ctx.home.name;
    const a = ctx.away.name;
    const lines = [
      `- Projection globale : ${ap.overall.home}% / ${ap.overall.away}%`,
      `- Forme : ${ap.form.home}% / ${ap.form.away}%`,
      `- Attaque : ${ap.attack.home}% / ${ap.attack.away}%`,
      `- Défense : ${ap.defense.home}% / ${ap.defense.away}%`,
      `- Historique des confrontations : ${ap.h2h.home}% / ${ap.h2h.away}%`,
      `- Rendement offensif comparé : ${ap.goals.home}% / ${ap.goals.away}%`,
    ];
    if (ap.percent) {
      lines.push(
        `- Probabilités du modèle tiers : ${ap.percent.home}% victoire ${h}, ${ap.percent.draw}% nul, ${ap.percent.away}% victoire ${a}`,
      );
    }
    const l5 = (side: 'home' | 'away', name: string) => {
      const v = ap.last_5[side];
      return v && v.played > 0
        ? `- 5 derniers matchs ${name} : forme ${v.form}%, attaque ${v.attack}%, défense ${v.defense}%`
        : null;
    };
    for (const line of [l5('home', h), l5('away', a)]) {
      if (line) lines.push(line);
    }
    afPredBlock =
      `
Modèle statistique tiers — comparaison ${h} / ${a} :
` +
      lines.join(String.fromCharCode(10)) +
      String.fromCharCode(10);
  }

  return `Contexte du match à venir :

Compétition : ${ctx.competition}${ctx.stage_or_matchday ? ` (${ctx.stage_or_matchday})` : ''}
Coup d'envoi : ${ctx.kickoff_at_iso}${ctx.venue ? ` — ${ctx.venue}` : ''}

${fmtTeam(ctx.home, 'Domicile')}

${fmtTeam(ctx.away, 'Extérieur')}

Confrontations directes récentes :${fmtH2HSummary(ctx)}${fmtReferee(ctx)}
${h2hLines}
${narratives}
${consensusBlock}${afPredBlock}
Génère l'analyse pré-match enrichie en JSON selon le schéma fourni.`;
}

export async function generateDeepPreMatchAnalysis(
  ctx: DeepPreMatchContext,
  options: { model?: string } = {},
): Promise<{
  analysis: DeepPreMatchAnalysis;
  model: string;
  usage: { input: number; output: number };
}> {
  // Analyse pré-match approfondie = l'artefact premium → modèle fort.
  const model = options.model ?? DEEP_MODEL;
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: DEEP_SYSTEM_PROMPT },
      { role: 'user', content: buildDeepPrompt(ctx) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'deep_pre_match_analysis',
        strict: true,
        schema: DEEP_PRE_MATCH_JSON_SCHEMA as unknown as Record<
          string,
          unknown
        >,
      },
    },
    // Les modèles de raisonnement (GPT-5+) refusent un temperature custom.
    ...(isReasoningModel(model) ? {} : { temperature: 0.5 }),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI a renvoyé une réponse vide.');
  const analysis = JSON.parse(content) as DeepPreMatchAnalysis;

  return {
    analysis,
    model,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}

// ============================================================================
// POST-MATCH
// ============================================================================

export type PostMatchPerformer = {
  name: string;
  rating: number | null;
  goals: number;
  assists: number;
};

export type PostMatchGoal = {
  minute: number;
  scorer: string;
  assist: string | null;
  detail: string | null;
  team_side: 'home' | 'away';
};

export type PostMatchContext = {
  competition: string;
  stage_or_matchday: string | null;
  kickoff_at_iso: string;
  venue: string | null;
  home: {
    name: string;
    country: string | null;
    score: number;
    half_time_score: number | null;
    starting_eleven: string[];
    /** Joueurs notés, triés par note décroissante (top performers) */
    top_performers?: PostMatchPerformer[];
  };
  away: {
    name: string;
    country: string | null;
    score: number;
    half_time_score: number | null;
    starting_eleven: string[];
    top_performers?: PostMatchPerformer[];
  };
  /** Buts du match dans l'ordre chronologique (avec buteur + passeur) */
  goal_events?: PostMatchGoal[];
};

const POST_SYSTEM_PROMPT = `Tu es un analyste football francophone pour Tactuo, une webapp d'analyse augmentée par l'IA.
Tu rédiges une lecture post-match factuelle et engageante : faits marquants, homme du match, performances notables, lecture tactique, moment-clé.

Règles :
- Français exclusivement. Ton factuel, mesuré, jamais sensationnaliste.
- Base-toi UNIQUEMENT sur les données fournies (score, score mi-temps, compositions, notes des joueurs, buteurs). Pas d'invention de stats.
- "Homme du match" : nomme EXPLICITEMENT le joueur — c'est en priorité celui avec la meilleure note parmi les "Top performers" fournis, en tenant compte de son impact (buts, passes décisives). Si aucune note n'est fournie, alors seulement reste générique ("l'attaquant principal de X").
- Ne cite QUE des joueurs présents dans les "Top performers", les buteurs, ou le XI titulaire fournis. N'invente AUCUN nom.
- Si des buteurs sont fournis, cite-les nommément dans les "facts" avec leur minute.
- "facts" : 3 à 5 faits chiffrés ou notables (score final, buteurs + minutes, score mi-temps, retournement, dynamique).
- "turning_point" : 1-2 phrases sur le moment qui a fait basculer le match.
- "tactical_reading" : 2-3 phrases sur ce que le résultat révèle du jeu des deux équipes.`;

function buildPostMatchPrompt(ctx: PostMatchContext): string {
  const fmtSquad = (squad: string[]) =>
    squad.length === 0 ? 'non publiée' : squad.join(', ');
  const fmtHT = (n: number | null) => (n != null ? String(n) : '?');

  const fmtPerformers = (perfs?: PostMatchPerformer[]) => {
    if (!perfs || perfs.length === 0) return 'notes non disponibles';
    return perfs
      .map((p) => {
        const bits: string[] = [];
        if (p.rating != null) bits.push(`note ${p.rating}`);
        if (p.goals > 0) bits.push(`${p.goals} but${p.goals > 1 ? 's' : ''}`);
        if (p.assists > 0)
          bits.push(`${p.assists} passe${p.assists > 1 ? 's' : ''} déc.`);
        return `${p.name}${bits.length ? ` (${bits.join(', ')})` : ''}`;
      })
      .join(', ');
  };

  const goalsLine = () => {
    if (!ctx.goal_events || ctx.goal_events.length === 0) {
      return 'Buteurs : non disponibles';
    }
    return (
      'Buts :\n' +
      ctx.goal_events
        .map((g) => {
          const team = g.team_side === 'home' ? ctx.home.name : ctx.away.name;
          const og = g.detail === 'Own Goal' ? ' csc' : '';
          const pen = g.detail === 'Penalty' ? ' (pen.)' : '';
          const assist = g.assist ? `, passe de ${g.assist}` : '';
          return `  ${g.minute}' — ${g.scorer}${og}${pen} (${team})${assist}`;
        })
        .join('\n')
    );
  };

  return `Contexte du match terminé :

Compétition : ${ctx.competition}${ctx.stage_or_matchday ? ` (${ctx.stage_or_matchday})` : ''}
Coup d'envoi : ${ctx.kickoff_at_iso}${ctx.venue ? ` — ${ctx.venue}` : ''}

Score final : ${ctx.home.name} ${ctx.home.score} - ${ctx.away.score} ${ctx.away.name}
Score mi-temps : ${fmtHT(ctx.home.half_time_score)} - ${fmtHT(ctx.away.half_time_score)}

${goalsLine()}

Équipe à domicile : ${ctx.home.name}${ctx.home.country ? ` (${ctx.home.country})` : ''}
- XI titulaire : ${fmtSquad(ctx.home.starting_eleven)}
- Top performers (note décroissante) : ${fmtPerformers(ctx.home.top_performers)}

Équipe à l'extérieur : ${ctx.away.name}${ctx.away.country ? ` (${ctx.away.country})` : ''}
- XI titulaire : ${fmtSquad(ctx.away.starting_eleven)}
- Top performers (note décroissante) : ${fmtPerformers(ctx.away.top_performers)}

Génère l'analyse post-match en JSON selon le schéma fourni. Nomme l'homme du match parmi les top performers.`;
}

export async function generatePostMatchAnalysis(
  ctx: PostMatchContext,
  options: { model?: string } = {},
): Promise<{
  analysis: PostMatchAnalysis;
  model: string;
  usage: { input: number; output: number };
}> {
  const model = options.model ?? DEFAULT_MODEL;
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: POST_SYSTEM_PROMPT },
      { role: 'user', content: buildPostMatchPrompt(ctx) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'post_match_analysis',
        strict: true,
        schema: POST_MATCH_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI a renvoyé une réponse vide.');
  }
  const analysis = JSON.parse(content) as PostMatchAnalysis;

  return {
    analysis,
    model,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}
