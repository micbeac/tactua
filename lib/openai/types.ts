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
