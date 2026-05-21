import type { PersonalUpcomingMatch } from '@/lib/data/favorites';
import type { DailyRecap, RecapNarrative } from '@/lib/data/recap';
import type { RecommendedPlayer } from '@/lib/data/recommendations';
import type { FavoritePerspective, WeeklyRecap } from '@/lib/data/weekly-recap';

/** Types d'items qu'on peut afficher dans le feed. */
export type FeedItem =
  | {
      type: 'upcoming_match';
      score: number;
      key: string;
      match: PersonalUpcomingMatch;
    }
  | {
      type: 'recent_result';
      score: number;
      key: string;
      result: FavoritePerspective;
    }
  | { type: 'news'; score: number; key: string; news: RecapNarrative }
  | { type: 'player_reco'; score: number; key: string; player: RecommendedPlayer };

const MAX_ITEMS = 12;

/**
 * Construit un flux personnalisé en mixant les différentes sources d'événements
 * (matchs à venir, résultats récents, news, joueurs recommandés) avec un score
 * de pertinence approximatif. Le score donne la priorité à :
 *
 *   - matchs favoris imminents (< 24h)        100-130
 *   - news fraîches (< 12h)                    90
 *   - résultats favoris des dernières 36h      85
 *   - matchs favoris entre 24h-72h             75
 *   - news entre 12h-36h                        65
 *   - matchs favoris > 72h                     50
 *   - reco joueur (top buteur, top passeur)    45-60
 */
export function buildForYouFeed(input: {
  personal: PersonalUpcomingMatch[];
  recap: DailyRecap;
  weeklyRecap: WeeklyRecap;
  recommendations: RecommendedPlayer[];
}): FeedItem[] {
  const now = Date.now();
  const items: FeedItem[] = [];

  // 1. Matchs imminents favoris
  for (const m of input.personal) {
    const diff = new Date(m.kickoff_at).getTime() - now;
    const hours = diff / (1000 * 60 * 60);
    let score: number;
    if (hours < 0)
      score = 95; // match en cours
    else if (hours < 6) score = 130;
    else if (hours < 24) score = 110;
    else if (hours < 72) score = 75;
    else score = 50;
    items.push({
      type: 'upcoming_match',
      score,
      key: `match-${m.id}`,
      match: m,
    });
  }

  // 2. Résultats récents (des 7 derniers jours, mais on priorise les + récents)
  for (const r of input.weeklyRecap.results.slice(0, 5)) {
    const days = Math.max(
      0,
      Math.floor((now - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24)),
    );
    // 85 pour hier, 70 pour il y a 2j, 60 pour 3j+
    const score = days === 0 ? 90 : days === 1 ? 85 : days === 2 ? 70 : 60;
    items.push({
      type: 'recent_result',
      score,
      key: `result-${r.match_id}-${r.favorite_team.id}`,
      result: r,
    });
  }

  // Note : les news étaient ici, mais elles sont déjà dans la section
  // "Ton foot du jour" → on évite le doublon en les retirant du feed.

  // 4. Recommandations joueurs (max 3 pour ne pas noyer le feed)
  for (let i = 0; i < Math.min(3, input.recommendations.length); i++) {
    const p = input.recommendations[i];
    // Score basé sur productivité (goals + assists)
    const score = 60 - i * 5;
    items.push({
      type: 'player_reco',
      score,
      key: `player-${p.player_id}`,
      player: p,
    });
  }

  // Trier par score décroissant et tronquer
  items.sort((a, b) => b.score - a.score);
  return items.slice(0, MAX_ITEMS);
}
