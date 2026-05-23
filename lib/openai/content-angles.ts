// Génération IA des angles vidéo TikTok (Tactuo backoffice).
//
// 2 appels OpenAI gpt-4o par match :
//   1. generateAngles(ctx)        → 3 angles éditoriaux (méta)
//   2. generateDeliverables(angle) → 6 livrables prod par angle (script, prompts,
//                                    instructions CapCut, caption…)
//
// Coût indicatif : ~3000 in + ~4000 out tokens / match ≈ 0,05 $ via gpt-4o.
// Stack maison (pas Anthropic), modèle DEEP_MODEL (gpt-4o par défaut).

import { DEEP_MODEL, getOpenAI, isReasoningModel } from './client.ts';

// ============================================================================
// Contexte de match (pré OU post match) injecté dans le prompt
// ============================================================================

export type AngleMatchContext = {
  phase: 'pre_match' | 'post_match';
  match_id: number;
  kickoff_iso: string;
  competition_name: string;
  championnat_code: string; // PL | Liga | SerieA | Bundesliga | L1 | CDM | CL | JPL
  home: TeamContext;
  away: TeamContext;
  /** Données spécifiques au match (post-match seulement) */
  match_outcome?: {
    score_home: number | null;
    score_away: number | null;
    half_time_home: number | null;
    half_time_away: number | null;
    events: Array<{
      minute: number | null;
      type: string;
      detail: string | null;
      team_name: string | null;
      player_name: string | null;
    }>;
    team_stats: Array<{
      team_name: string;
      possession: number | null;
      shots: number | null;
      shots_on_target: number | null;
      corners: number | null;
      xg: number | null;
    }>;
    top_player_stats: Array<{
      player_name: string;
      team_name: string;
      rating: number | null;
      goals: number | null;
      assists: number | null;
      shots: number | null;
      key_passes: number | null;
    }>;
  };
  /** Données spécifiques au match (pre-match seulement) */
  pre_match_inputs?: {
    h2h: Array<{
      kickoff_iso: string;
      home_team: string;
      away_team: string;
      score_home: number | null;
      score_away: number | null;
    }>;
  };
};

export type TeamContext = {
  id: number;
  name: string;
  form_last_5: ('W' | 'D' | 'L')[] | null;
  position: number | null;
  total_teams: number | null;
  points: number | null;
  xg_for_avg: number | null;
  xg_against_avg: number | null;
  scored_early_pct: number | null;
  scored_late_pct: number | null;
  conceded_early_pct: number | null;
  conceded_late_pct: number | null;
  top_scorers: Array<{ name: string; goals: number; assists: number }>;
};

// ============================================================================
// Sortie : angles (3 par match) + livrables (6 par angle)
// ============================================================================

export type AngleProposal = {
  format: string;
  hook: string;
  title: string;
  data_points: string[];
  narrative: string;
  joueur_principal: string | null;
  club_principal: string | null;
  championnat: string;
  score_viralite: number;
  cta_tactuo: string;
  urgence: 'live' | '24h' | '72h' | 'evergreen';
};

export type AnglesResponse = { angles: AngleProposal[] };

export type AngleDeliverables = {
  script_timecode: string;
  prompt_elevenlabs: string;
  prompts_visuels_ia: Array<{
    outil: 'leonardo' | 'chatgpt';
    moment_video: string;
    prompt: string;
    specs: string;
  }>;
  sources_visuels_a_chercher: Array<{
    type: string;
    moment_video: string;
    sujet: string;
    lien_recherche: string;
    instructions: string;
  }>;
  instructions_capcut: string;
  caption_tiktok: string;
  hashtags: string;
};

// ============================================================================
// Schémas JSON (response_format gpt-4o strict)
// ============================================================================

const ANGLES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['angles'],
  properties: {
    angles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'format',
          'hook',
          'title',
          'data_points',
          'narrative',
          'joueur_principal',
          'club_principal',
          'championnat',
          'score_viralite',
          'cta_tactuo',
          'urgence',
        ],
        properties: {
          format: { type: 'string' },
          hook: { type: 'string' },
          title: { type: 'string' },
          data_points: { type: 'array', items: { type: 'string' } },
          narrative: { type: 'string' },
          joueur_principal: { type: ['string', 'null'] },
          club_principal: { type: ['string', 'null'] },
          championnat: { type: 'string' },
          score_viralite: { type: 'number' },
          cta_tactuo: { type: 'string' },
          urgence: { type: 'string', enum: ['live', '24h', '72h', 'evergreen'] },
        },
      },
    },
  },
} as const;

const DELIVERABLES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'script_timecode',
    'prompt_elevenlabs',
    'prompts_visuels_ia',
    'sources_visuels_a_chercher',
    'instructions_capcut',
    'caption_tiktok',
    'hashtags',
  ],
  properties: {
    script_timecode: { type: 'string' },
    prompt_elevenlabs: { type: 'string' },
    prompts_visuels_ia: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['outil', 'moment_video', 'prompt', 'specs'],
        properties: {
          outil: { type: 'string', enum: ['leonardo', 'chatgpt'] },
          moment_video: { type: 'string' },
          prompt: { type: 'string' },
          specs: { type: 'string' },
        },
      },
    },
    sources_visuels_a_chercher: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'type',
          'moment_video',
          'sujet',
          'lien_recherche',
          'instructions',
        ],
        properties: {
          type: { type: 'string' },
          moment_video: { type: 'string' },
          sujet: { type: 'string' },
          lien_recherche: { type: 'string' },
          instructions: { type: 'string' },
        },
      },
    },
    instructions_capcut: { type: 'string' },
    caption_tiktok: { type: 'string' },
    hashtags: { type: 'string' },
  },
} as const;

// ============================================================================
// SYSTEM_PROMPT_1 — Détecteur d'angles
// ============================================================================

function buildAnglesSystemPrompt(phase: 'pre_match' | 'post_match'): string {
  const phaseHint =
    phase === 'pre_match'
      ? 'Le match N\'A PAS encore eu lieu. Tes angles doivent porter sur l\'avant-match : enjeu, contexte, stats saison, H2H, joueurs clés, patterns récurrents. Évite tout angle qui parle du résultat (tu ne l\'as pas).'
      : 'Le match VIENT DE SE TERMINER. Tes angles peuvent commenter le résultat, les performances individuelles, les stats du match, et croiser avec la forme saison.';

  return `Tu es l'éditeur en chef de Tactuo, app de stats foot avancées.
Mission : transformer la data d'un match en 3 angles de vidéos TikTok à fort potentiel viral.

${phaseHint}

Audience : fans foot 18-35 ans francophones (FR/BE/CH), niveau intermédiaire/avancé.
Ils veulent des insights qu'ils n'ont pas vus sur Twitter ou Canal+.

Ligne édito :
- STATS UNIQUEMENT, jamais de pronos / cotes (Tactuo ≠ gambling)
- Top 5 européen + Champions League + Coupe du Monde 2026 prioritaires
- Ton analytique mais accessible, jamais pédant
- Toujours basé sur la data fournie, JAMAIS d'inventions

Formats validés (varie dans tes 3 propositions) :
1. STAT_REVEAL — chiffre contre-intuitif qui claque
2. PLAYER_COMPARE — 2 joueurs face à face sur métrique cachée
3. GRAPH_ANIMATE — évolution dans le temps
4. PRE_MATCH — 3 stats avant un match imminent (réservé phase pre_match)
5. POST_MATCH — LA stat qui explique le résultat (réservé phase post_match)
6. TOP_RANKING — top 5 surprenant
7. PATTERN_REVEAL — récurrence cachée
8. XG_VS_REAL — sur/sous-performance vs xG

Critères score viralité (1-10) :
- Hook contre-intuitif (casse narrative dominante) : +3
- Chiffre précis et marquant : +2
- Joueur star ou club populaire : +2
- Timing event-driven : +2
- Data avancée peu connue : +1

Règles strictes :
- 3 angles exactement, formats DIFFÉRENTS
- Au moins 2 angles avec score ≥ 7
- Jamais d'invention : si la data ne te le dit pas, tu ne l'écris pas
- "championnat" = code court : PL, Liga, SerieA, Bundesliga, L1, CDM, CL, JPL ou autre
- "urgence" :
  - "live" → action immédiate (live ou H+0/+30 min après match)
  - "24h" → à produire dans les 24h max (chaud)
  - "72h" → à produire dans les 72h (encore d'actu)
  - "evergreen" → angle saisonnier, peut attendre

Pour la phase ${phase}, certains formats sont mieux adaptés :
- pre_match : PRE_MATCH, PLAYER_COMPARE, PATTERN_REVEAL, STAT_REVEAL, TOP_RANKING, XG_VS_REAL
- post_match : POST_MATCH, STAT_REVEAL, PLAYER_COMPARE, XG_VS_REAL, GRAPH_ANIMATE`;
}

function buildAnglesUserPrompt(ctx: AngleMatchContext): string {
  const lines: string[] = [];
  lines.push(`Match : ${ctx.home.name} vs ${ctx.away.name}`);
  lines.push(`Compétition : ${ctx.competition_name} (code ${ctx.championnat_code})`);
  lines.push(`Coup d'envoi : ${ctx.kickoff_iso}`);
  lines.push(`Phase : ${ctx.phase}`);

  function teamBlock(t: TeamContext, side: 'Domicile' | 'Extérieur') {
    lines.push(`\n[${side}] ${t.name}`);
    if (t.form_last_5)
      lines.push(`  Forme 5 derniers : ${t.form_last_5.join('')}`);
    if (t.position && t.total_teams)
      lines.push(
        `  Classement : ${t.position}e / ${t.total_teams} (${t.points ?? '?'} pts)`,
      );
    if (t.xg_for_avg != null)
      lines.push(`  xG marqué / match (saison) : ${t.xg_for_avg}`);
    if (t.xg_against_avg != null)
      lines.push(`  xG concédé / match : ${t.xg_against_avg}`);
    if (t.scored_early_pct != null)
      lines.push(
        `  Tempo des buts : ${t.scored_early_pct}% marqués 0-15', ${t.scored_late_pct ?? '?'}% marqués 76'+`,
      );
    if (t.conceded_early_pct != null)
      lines.push(
        `  Tempo encaissés : ${t.conceded_early_pct}% 0-15', ${t.conceded_late_pct ?? '?'}% 76'+`,
      );
    if (t.top_scorers.length > 0) {
      lines.push(`  Top buteurs : ${t.top_scorers.map((p) => `${p.name} (${p.goals}b/${p.assists}p)`).join(', ')}`);
    }
  }

  teamBlock(ctx.home, 'Domicile');
  teamBlock(ctx.away, 'Extérieur');

  if (ctx.pre_match_inputs?.h2h && ctx.pre_match_inputs.h2h.length > 0) {
    lines.push('\n[H2H 5 derniers]');
    for (const m of ctx.pre_match_inputs.h2h) {
      lines.push(
        `  ${m.kickoff_iso.slice(0, 10)} : ${m.home_team} ${m.score_home ?? '?'} - ${m.score_away ?? '?'} ${m.away_team}`,
      );
    }
  }

  if (ctx.match_outcome) {
    const o = ctx.match_outcome;
    lines.push(
      `\n[Résultat] ${o.score_home ?? 0} - ${o.score_away ?? 0} (mi-temps ${o.half_time_home ?? 0} - ${o.half_time_away ?? 0})`,
    );
    if (o.team_stats.length > 0) {
      lines.push('[Stats équipe]');
      for (const s of o.team_stats) {
        lines.push(
          `  ${s.team_name} : ${s.possession ?? '?'}% poss, ${s.shots ?? '?'} tirs (${s.shots_on_target ?? '?'} cadrés), ${s.corners ?? '?'} corners, xG ${s.xg ?? '?'}`,
        );
      }
    }
    if (o.events.length > 0) {
      lines.push('[Événements]');
      for (const e of o.events.slice(0, 20)) {
        lines.push(
          `  ${e.minute ?? '?'}' [${e.type}${e.detail ? `/${e.detail}` : ''}] ${e.team_name ?? ''} ${e.player_name ?? ''}`.trim(),
        );
      }
    }
    if (o.top_player_stats.length > 0) {
      lines.push('[Joueurs marquants]');
      for (const p of o.top_player_stats.slice(0, 8)) {
        lines.push(
          `  ${p.player_name} (${p.team_name}) — note ${p.rating ?? '?'}, ${p.goals ?? 0}b/${p.assists ?? 0}p, ${p.shots ?? 0} tirs, ${p.key_passes ?? 0} passes clés`,
        );
      }
    }
  }

  lines.push('\nProduis maintenant 3 angles JSON suivant le schéma strict.');
  return lines.join('\n');
}

export async function generateAngles(
  ctx: AngleMatchContext,
): Promise<{ angles: AngleProposal[]; model: string }> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: DEEP_MODEL,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'tactuo_angles',
        strict: true,
        schema: ANGLES_SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: buildAnglesSystemPrompt(ctx.phase) },
      { role: 'user', content: buildAnglesUserPrompt(ctx) },
    ],
    ...(isReasoningModel(DEEP_MODEL) ? {} : { temperature: 0.7 }),
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('OpenAI returned empty content (angles)');
  const parsed = JSON.parse(raw) as AnglesResponse;
  return { angles: parsed.angles, model: completion.model };
}

// ============================================================================
// SYSTEM_PROMPT_2 — Générateur livrables prod
// ============================================================================

const DELIVERABLES_SYSTEM = `Tu es directeur de production TikTok pour Tactuo.
Tu reçois un angle de vidéo. Tu génères 6 livrables PRÊTS À PRODUIRE manuellement (l'utilisateur copie-colle dans CapCut, ElevenLabs, Leonardo, ChatGPT).

Contraintes outils :
- Montage : CapCut (templates + sous-titres auto + library musique)
- Voix off : ElevenLabs (voix française masculine "analyste posé")
- Visuels génératifs : Leonardo AI OU ChatGPT (DALL-E)
- Photos joueurs : Wikimedia Commons (libre de droits)
- B-roll ambiance : Pexels/Unsplash (gratuit, libre)

RÈGLE CRITIQUE sur les visuels :
- JAMAIS demander à l'IA de générer une personne réelle nommée (ex: "Haaland" interdit dans un prompt Leonardo)
- Pour les joueurs : ajouter une entrée dans sources_visuels_a_chercher avec URL Wikimedia
- Pour les ambiances / abstractions : générer via Leonardo / ChatGPT (safe)

Contraintes format :
- Durée vidéo : 25-30 s max
- Ratio 9:16 (1080 x 1920)
- Palette Tactuo : navy + vert primary
- Script en français, ton analytique mais punchy

Pour prompt_elevenlabs : texte EXACT à coller, français, durée parlée 25-30s, format speech avec pauses (...) et emphases (MOTS EN MAJUSCULES). Voix recommandée : "Adam" ou "Antoni" en français, stability 50%, similarity 75%.

Pour prompts_visuels_ia : prompts en ANGLAIS détaillés pour Leonardo (modèle Phoenix ou Flux), style cinématique, ratio 9:16. Toujours exclure toute personne nommée. Donne 2 à 4 prompts visuels selon les besoins du script.

Pour sources_visuels_a_chercher : 0 à 3 entrées pour les photos de joueurs/clubs réels. URL Wikimedia Commons (https://commons.wikimedia.org/wiki/Special:Search?search=Nom+Prenom). Instructions : « CC BY/SA, portrait, photo la plus récente ».

Pour instructions_capcut : étapes numérotées niveau débutant.

Pour caption_tiktok : hook 1 ligne + contexte 1-2 lignes + CTA Tactuo + « Lien en bio 👇 ».

Pour hashtags : 10-12 hashtags pertinents, mix génériques (#foot, #stats, #tactuo) + spécifiques (joueur, club, événement).`;

function buildDeliverablesUserPrompt(
  angle: AngleProposal,
  ctx: AngleMatchContext,
): string {
  return [
    `Match concerné : ${ctx.home.name} vs ${ctx.away.name} (${ctx.competition_name})`,
    `Format : ${angle.format}`,
    `Hook : ${angle.hook}`,
    `Titre interne : ${angle.title}`,
    `Narratif : ${angle.narrative}`,
    `Data points clés :`,
    ...angle.data_points.map((d) => `  - ${d}`),
    `Joueur principal : ${angle.joueur_principal ?? '—'}`,
    `Club principal : ${angle.club_principal ?? '—'}`,
    `Urgence : ${angle.urgence}`,
    `CTA Tactuo : ${angle.cta_tactuo}`,
    '',
    'Génère maintenant les 6 livrables JSON strict.',
  ].join('\n');
}

export async function generateDeliverables(
  angle: AngleProposal,
  ctx: AngleMatchContext,
): Promise<{ deliverables: AngleDeliverables; model: string }> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: DEEP_MODEL,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'tactuo_deliverables',
        strict: true,
        schema: DELIVERABLES_SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: DELIVERABLES_SYSTEM },
      { role: 'user', content: buildDeliverablesUserPrompt(angle, ctx) },
    ],
    ...(isReasoningModel(DEEP_MODEL) ? {} : { temperature: 0.6 }),
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('OpenAI returned empty content (deliverables)');
  const parsed = JSON.parse(raw) as AngleDeliverables;
  return { deliverables: parsed, model: completion.model };
}
