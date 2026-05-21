// Generator IA pour les pages news internes Tactuo.
// Prend un narrative scrapé (titre + snippet + source + équipe) et génère :
//   - ai_summary : 1-2 phrases TLDR (pour cards, méta description SEO)
//   - ai_content : 400-500 mots en Markdown (corps de l'article)
//   - ai_perspective : 2-3 phrases "pourquoi ça compte pour [équipe]"
//
// Le contenu est reformulé (transformative use) et inclut systématiquement
// du contexte Tactuo (forme récente, position, prochain match) pour être
// original et utile aux LLM extractors / Google AI Overviews.

import { DEFAULT_MODEL, getOpenAI } from './client';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'content', 'perspective'],
  properties: {
    summary: { type: 'string' },
    content: { type: 'string' },
    perspective: { type: 'string' },
  },
} as const;

export type NewsContent = {
  summary: string;
  content: string;
  perspective: string;
};

export type NewsContext = {
  /** Titre de la news scrapée */
  title: string;
  /** Snippet/excerpt scrapé */
  snippet: string | null;
  /** URL source (pour attribution) */
  source_url: string | null;
  /** Nom de l'équipe concernée */
  team_name: string;
  /** Code/pays de la compétition principale (ex : "Serie A") */
  competition_name?: string | null;
  /** Forme récente W/D/L (5 derniers) si dispo */
  recent_form?: ('W' | 'D' | 'L')[] | null;
  /** Position au classement si dispo */
  league_position?: number | null;
  /** Prochain match (équipe adverse + date) si dispo */
  next_match?: { opponent: string; date_iso: string } | null;
};

function buildSystemPrompt(): string {
  return `Tu es rédacteur sportif pour Tactuo, plateforme d'analyse foot.

Mission : à partir d'une news brute (titre + snippet d'un média externe), produire un article ORIGINAL en français qui :
- Reformule (pas de copie de phrases), pour éviter le duplicate content
- Apporte du contexte tactique/statistique propre à Tactuo (forme, classement, prochain match si fourni)
- Cite des chiffres concrets quand possible
- Reste factuel, jamais inventif (si tu ne sais pas, ne dis pas)
- Adresse l'audience footophile française (pas de simplifications enfantines)

Trois sorties strictement séparées :
- summary : 1 à 2 phrases (≤ 280 caractères, pour la méta description et les cards)
- content : 400-500 mots en Markdown propre (## sous-titres OK, pas d'image, pas de tableau)
- perspective : 2-3 phrases sur "pourquoi cette info compte pour l'équipe maintenant", angle Tactuo

Style content : 3-4 sections courtes avec sous-titres ##. Inclus le contexte Tactuo (chiffres fournis) naturellement, pas comme un encart séparé. Termine par une phrase ouverte sur l'avenir (prochain match, mercato, etc.). Pas de signature, pas de "selon nos sources", pas d'opinion personnelle.`;
}

function buildUserPrompt(ctx: NewsContext): string {
  const lines: string[] = [];
  lines.push(`Équipe concernée : ${ctx.team_name}`);
  if (ctx.competition_name) lines.push(`Compétition : ${ctx.competition_name}`);
  if (ctx.league_position != null)
    lines.push(`Position au classement : ${ctx.league_position}e`);
  if (ctx.recent_form && ctx.recent_form.length > 0) {
    const w = ctx.recent_form.filter((r) => r === 'W').length;
    const d = ctx.recent_form.filter((r) => r === 'D').length;
    const l = ctx.recent_form.filter((r) => r === 'L').length;
    lines.push(
      `Forme récente (${ctx.recent_form.length} derniers) : ${w}V-${d}N-${l}D — séquence ${ctx.recent_form.join('')}`,
    );
  }
  if (ctx.next_match) {
    lines.push(
      `Prochain match : ${ctx.next_match.opponent} le ${ctx.next_match.date_iso.slice(0, 10)}`,
    );
  }
  lines.push('');
  lines.push(`Titre de la news : "${ctx.title}"`);
  if (ctx.snippet) lines.push(`Extrait scrapé : "${ctx.snippet}"`);
  if (ctx.source_url) lines.push(`Source : ${ctx.source_url}`);
  lines.push('');
  lines.push(
    "Produis maintenant summary + content (400-500 mots Markdown) + perspective.",
  );
  return lines.join('\n');
}

export async function generateNewsContent(
  ctx: NewsContext,
): Promise<{ content: NewsContent; model: string }> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'news_content',
        strict: true,
        schema: SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(ctx) },
    ],
    temperature: 0.5,
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('OpenAI returned empty content');
  const parsed = JSON.parse(raw) as NewsContent;
  return { content: parsed, model: completion.model };
}

/**
 * Génère un slug court depuis un titre + id pour les URLs internes.
 * Format : `paris-saint-germain-bastoni-12345`
 */
export function buildNewsSlug(title: string, id: number): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base ? `${base}-${id}` : `news-${id}`;
}

export function parseNewsSlug(slug: string): number | null {
  const m = slug.match(/(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
