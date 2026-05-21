// Types et schémas JSON pour les analyses IA pré/post-match.

export type TeamSide = 'home' | 'away';

export type KeyPlayer = {
  team: TeamSide;
  name: string;
  why: string;
};

/**
 * Structure stockée dans `match_analyses.content_json` pour les analyses
 * pré-match. Le schéma JSON ci-dessous garantit que la sortie d'OpenAI
 * (response_format json_schema strict) match exactement cette forme.
 */
export type PreMatchAnalysis = {
  tactical_overview: {
    home_approach: string;
    away_approach: string;
    key_battle: string;
  };
  form_assessment: {
    home_form: string;
    away_form: string;
  };
  key_players: KeyPlayer[];
  weak_points: {
    home: string;
    away: string;
  };
  prediction: {
    summary: string;
    scoreline_guess: string;
  };
};

/**
 * Analyse pré-match enrichie (version "deep") — produite quand on dispose
 * des stats détaillées via API-Football Pro.
 * Conserve toutes les sections de la PreMatchAnalysis + ajoute :
 *   - data_insight : ce que les chiffres révèlent (1 paragraphe synthétique)
 *   - prediction.probabilities : home/draw/away en pourcentages
 *   - prediction.btts : "yes" ou "no" + justification
 *   - prediction.over_2_5 : "yes" ou "no"
 *   - prediction.confidence : low/medium/high
 */
/**
 * Scénario possible du match. L'IA en propose 3, ordonnés par probabilité.
 * Le narratif décrit comment le match pourrait se dérouler (rythme, phases,
 * issue), en s'appuyant sur les stats fournies.
 */
export type MatchScenario = {
  title: string;
  narrative: string;
  likelihood: 'élevée' | 'moyenne' | 'faible';
};

// ============================================================================
// Données calculées côté backend (pas IA). Garantit l'exactitude des chiffres.
// Stockées dans content_json.rich_data pour rendu visuel détaillé.
// ============================================================================

/** Comparaison stat par stat entre les 2 équipes. */
export type StatComparison = {
  label: string;
  home: string;
  away: string;
  advantage: 'home' | 'away' | 'equal';
};

/** Dimension du radar de comparaison (0-100). */
export type RadarDimension = {
  label: string;
  home: number;
  away: number;
};

export type RecentFormResult = 'W' | 'D' | 'L';

/** Détail joueur clé avec stats saison. */
export type PlayerSeasonStat = {
  /** AF id (toujours présent) — sert au popup et à la résolution DB */
  af_player_id: number;
  /** DB id si le joueur existe dans notre table players (link vers /players/[id]) */
  db_player_id: number | null;
  /** URL photo joueur (depuis API-Football) */
  photo: string | null;
  name: string;
  team: 'home' | 'away';
  position: string | null;
  is_captain: boolean;
  appearances: number;
  goals: number;
  assists: number;
  rating: number | null;
  shots_on_target: number | null;
  key_passes: number | null;
  passes_accuracy: number | null;
};

/** Indisponibles (blessures/suspensions). */
export type AbsentPlayer = {
  team: 'home' | 'away';
  name: string;
  reason: string | null;
};

export type MatchRichData = {
  /** Comparaison stat par stat (6-8 lignes). */
  stats_compare: StatComparison[];
  /** Radar 5 dimensions (Attaque/Défense/Forme/Régularité/Globale). */
  radar: RadarDimension[];
  /** Forme récente (5 derniers, du + ancien au + récent). */
  form_home: RecentFormResult[];
  form_away: RecentFormResult[];
  /** Forme longue saison (10-20 caractères). */
  form_long_home: string;
  form_long_away: string;
  /** Top joueurs des 2 équipes avec stats détaillées. */
  top_players: PlayerSeasonStat[];
  /** Joueurs indisponibles connus. */
  absent_players: AbsentPlayer[];
  /** Formation type de chaque équipe. */
  formation_home: string | null;
  formation_away: string | null;
  /** Récap H2H : nb victoires home / nuls / victoires away sur les derniers matchs. */
  h2h_summary: {
    home_wins: number;
    draws: number;
    away_wins: number;
    total: number;
  };
};

export type DeepPreMatchAnalysis = {
  tactical_overview: {
    home_approach: string;
    away_approach: string;
    key_battle: string;
  };
  form_assessment: {
    home_form: string;
    away_form: string;
  };
  key_players: KeyPlayer[];
  weak_points: {
    home: string;
    away: string;
  };
  data_insight: string;
  scenarios: MatchScenario[];
  prediction: {
    summary: string;
    scoreline_guess: string;
    probabilities: {
      home_win: number;
      draw: number;
      away_win: number;
    };
    btts: 'yes' | 'no';
    btts_reason: string;
    over_2_5: 'yes' | 'no';
    over_2_5_reason: string;
    confidence: 'low' | 'medium' | 'high';
  };
  /** Données calculées en backend (post-IA), facultatif pour compat ascendante. */
  rich_data?: MatchRichData;
};

export type PostMatchAnalysis = {
  facts: string[];
  man_of_the_match: {
    name: string;
    team: TeamSide;
    why: string;
  };
  notable_performances: KeyPlayer[];
  tactical_reading: string;
  turning_point: string;
};

/** JSON Schema strict pour l'analyse pré-match enrichie. */
export const DEEP_PRE_MATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'tactical_overview',
    'form_assessment',
    'key_players',
    'weak_points',
    'data_insight',
    'scenarios',
    'prediction',
  ],
  properties: {
    tactical_overview: {
      type: 'object',
      additionalProperties: false,
      required: ['home_approach', 'away_approach', 'key_battle'],
      properties: {
        home_approach: { type: 'string' },
        away_approach: { type: 'string' },
        key_battle: { type: 'string' },
      },
    },
    form_assessment: {
      type: 'object',
      additionalProperties: false,
      required: ['home_form', 'away_form'],
      properties: {
        home_form: { type: 'string' },
        away_form: { type: 'string' },
      },
    },
    key_players: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['team', 'name', 'why'],
        properties: {
          team: { type: 'string', enum: ['home', 'away'] },
          name: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    weak_points: {
      type: 'object',
      additionalProperties: false,
      required: ['home', 'away'],
      properties: {
        home: { type: 'string' },
        away: { type: 'string' },
      },
    },
    data_insight: { type: 'string' },
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'narrative', 'likelihood'],
        properties: {
          title: { type: 'string' },
          narrative: { type: 'string' },
          likelihood: {
            type: 'string',
            enum: ['élevée', 'moyenne', 'faible'],
          },
        },
      },
    },
    prediction: {
      type: 'object',
      additionalProperties: false,
      required: [
        'summary',
        'scoreline_guess',
        'probabilities',
        'btts',
        'btts_reason',
        'over_2_5',
        'over_2_5_reason',
        'confidence',
      ],
      properties: {
        summary: { type: 'string' },
        scoreline_guess: { type: 'string' },
        probabilities: {
          type: 'object',
          additionalProperties: false,
          required: ['home_win', 'draw', 'away_win'],
          properties: {
            home_win: { type: 'number' },
            draw: { type: 'number' },
            away_win: { type: 'number' },
          },
        },
        btts: { type: 'string', enum: ['yes', 'no'] },
        btts_reason: { type: 'string' },
        over_2_5: { type: 'string', enum: ['yes', 'no'] },
        over_2_5_reason: { type: 'string' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
    },
  },
} as const;

/** JSON Schema strict envoyé à l'API OpenAI pour le post-match. */
export const POST_MATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'facts',
    'man_of_the_match',
    'notable_performances',
    'tactical_reading',
    'turning_point',
  ],
  properties: {
    facts: {
      type: 'array',
      items: { type: 'string' },
    },
    man_of_the_match: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'team', 'why'],
      properties: {
        name: { type: 'string' },
        team: { type: 'string', enum: ['home', 'away'] },
        why: { type: 'string' },
      },
    },
    notable_performances: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['team', 'name', 'why'],
        properties: {
          team: { type: 'string', enum: ['home', 'away'] },
          name: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    tactical_reading: { type: 'string' },
    turning_point: { type: 'string' },
  },
} as const;

/** JSON Schema strict envoyé à l'API OpenAI pour le pré-match. */
export const PRE_MATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'tactical_overview',
    'form_assessment',
    'key_players',
    'weak_points',
    'prediction',
  ],
  properties: {
    tactical_overview: {
      type: 'object',
      additionalProperties: false,
      required: ['home_approach', 'away_approach', 'key_battle'],
      properties: {
        home_approach: { type: 'string' },
        away_approach: { type: 'string' },
        key_battle: { type: 'string' },
      },
    },
    form_assessment: {
      type: 'object',
      additionalProperties: false,
      required: ['home_form', 'away_form'],
      properties: {
        home_form: { type: 'string' },
        away_form: { type: 'string' },
      },
    },
    key_players: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['team', 'name', 'why'],
        properties: {
          team: { type: 'string', enum: ['home', 'away'] },
          name: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    weak_points: {
      type: 'object',
      additionalProperties: false,
      required: ['home', 'away'],
      properties: {
        home: { type: 'string' },
        away: { type: 'string' },
      },
    },
    prediction: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'scoreline_guess'],
      properties: {
        summary: { type: 'string' },
        scoreline_guess: { type: 'string' },
      },
    },
  },
} as const;
