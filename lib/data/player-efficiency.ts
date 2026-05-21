import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type PlayerEfficiency = {
  /** Total titularisations toutes compétitions */
  total_appearances: number;
  total_minutes: number;
  total_goals: number;
  total_assists: number;

  /** Buts par match (g/app) */
  goals_per_match: number;
  /** Passes par match (a/app) */
  assists_per_match: number;
  /** Productivité offensive (B+A par match) */
  productivity_per_match: number;
  /** Minutes par match — montre si titulaire complet ou souvent sorti */
  minutes_per_match: number;
  /** Pourcentage de minutes jouées sur le total possible (apps × 90) */
  minutes_pct: number;

  /** Indices "style xG/xA" (proxy) calculés depuis les agrégats — sur 100 */
  finishing_index: number; // basé sur productivité
  involvement_index: number; // basé sur minutes_pct
  threat_index: number; // basé sur ratio buts/passes (= profil but-créateur)
  discipline_index: number; // basé sur cartons

  /** Profil dominant : "Finisseur", "Créateur", "Box-to-box", "Régulier" */
  profile_label: string;
};

/**
 * Calcule les indices d'efficacité d'un joueur depuis ses player_season_stats
 * agrégés (toutes compétitions). Proxy en attendant les vrais xG/xA via
 * Sofascore (cf. memory project_xg_sofascore_upgrade).
 */
export async function getPlayerEfficiency(
  supabase: Supa,
  playerId: number,
): Promise<PlayerEfficiency | null> {
  const { data } = await supabase
    .from('player_season_stats')
    .select('appearances, minutes, goals, assists, yellow_cards, red_cards')
    .eq('player_id', playerId);

  type StatRow = {
    appearances: number | null;
    minutes: number | null;
    goals: number | null;
    assists: number | null;
    yellow_cards: number | null;
    red_cards: number | null;
  };

  const rows = (data ?? []) as StatRow[];
  if (rows.length === 0) return null;

  const totals = {
    appearances: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
  };
  for (const r of rows) {
    totals.appearances += r.appearances ?? 0;
    totals.minutes += r.minutes ?? 0;
    totals.goals += r.goals ?? 0;
    totals.assists += r.assists ?? 0;
    totals.yellow_cards += r.yellow_cards ?? 0;
    totals.red_cards += r.red_cards ?? 0;
  }

  if (totals.appearances === 0) return null;

  const goalsPerMatch = totals.goals / totals.appearances;
  const assistsPerMatch = totals.assists / totals.appearances;
  const productivityPerMatch = goalsPerMatch + assistsPerMatch;
  const minutesPerMatch = totals.minutes / totals.appearances;
  const minutesPct = (totals.minutes / (totals.appearances * 90)) * 100;

  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  // Indices proxy (échelle empirique sur saisons de top championnats)
  // - Productivité 1.0/match = 100% (Lautaro/Mbappé level)
  // - Implication = % minutes jouées (titulaire complet ≈ 100%)
  // - Menace = B / (B+A) — proche de 100% = pur finisseur
  // - Discipline = inverse des cartons
  const finishing = clamp(productivityPerMatch * 100);
  const involvement = clamp(minutesPct);
  let threat = 50;
  if (totals.goals + totals.assists > 0) {
    threat = clamp((totals.goals / (totals.goals + totals.assists)) * 100);
  }
  const discipline = clamp(
    100 - (totals.yellow_cards * 8 + totals.red_cards * 25),
  );

  // Profil dominant
  let profile_label = 'Régulier';
  if (productivityPerMatch >= 0.7) {
    profile_label = goalsPerMatch > assistsPerMatch ? 'Finisseur' : 'Créateur';
  } else if (assistsPerMatch >= 0.25 && goalsPerMatch < 0.15) {
    profile_label = 'Créateur';
  } else if (goalsPerMatch >= 0.3 && assistsPerMatch < 0.15) {
    profile_label = 'Finisseur';
  } else if (productivityPerMatch >= 0.4) {
    profile_label = 'Box-to-box';
  } else if (minutesPct >= 85 && discipline >= 80) {
    profile_label = 'Pilier défensif';
  }

  return {
    total_appearances: totals.appearances,
    total_minutes: totals.minutes,
    total_goals: totals.goals,
    total_assists: totals.assists,
    goals_per_match: goalsPerMatch,
    assists_per_match: assistsPerMatch,
    productivity_per_match: productivityPerMatch,
    minutes_per_match: minutesPerMatch,
    minutes_pct: minutesPct,
    finishing_index: Math.round(finishing),
    involvement_index: Math.round(involvement),
    threat_index: Math.round(threat),
    discipline_index: Math.round(discipline),
    profile_label,
  };
}
