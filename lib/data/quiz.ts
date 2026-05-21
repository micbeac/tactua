// Quiz quotidien Tactuo. 5 questions tirées de la base, déterministes
// pour une date donnée (même quiz pour tout le monde le même jour).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type QuizOption = {
  id: string;
  label: string;
};

export type QuizQuestion = {
  id: string; // ex "q1", "q2"
  prompt: string;
  hint: string | null;
  options: QuizOption[];
  correct_option_id: string;
  context_href: string | null; // lien vers fiche pour révision après
};

export type DailyQuiz = {
  day: string; // YYYY-MM-DD
  questions: QuizQuestion[];
};

// ============================================================================
// PRNG déterministe pour un jour donné (mulberry32 seedé sur la date)
// ============================================================================

function hashDay(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function pick<T>(arr: T[], n: number, rng: () => number): T[] {
  return shuffle(arr, rng).slice(0, n);
}

// ============================================================================
// Générateurs de questions
// ============================================================================

type FinishedMatch = {
  id: number;
  score_home: number;
  score_away: number;
  home_team: { id: number; name: string } | null;
  away_team: { id: number; name: string } | null;
};

async function fetchFinishedMatchPool(supabase: Supa): Promise<FinishedMatch[]> {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('matches')
    .select(
      `id, score_home, score_away,
       home_team:teams!matches_home_team_id_fkey(id, name),
       away_team:teams!matches_away_team_id_fkey(id, name)`,
    )
    .eq('status', 'finished')
    .not('score_home', 'is', null)
    .not('score_away', 'is', null)
    .gte('kickoff_at', since)
    .order('kickoff_at', { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as FinishedMatch[]).filter(
    (m) => m.home_team && m.away_team,
  );
}

function genScoreQuestion(
  match: FinishedMatch,
  rng: () => number,
  qIdx: number,
): QuizQuestion | null {
  if (!match.home_team || !match.away_team) return null;
  const home = match.home_team.name;
  const away = match.away_team.name;
  const real = `${match.score_home}-${match.score_away}`;
  const fakes = new Set<string>();
  // Variations plausibles
  const variants = [
    `${match.score_home + 1}-${match.score_away}`,
    `${match.score_home}-${match.score_away + 1}`,
    `${Math.max(0, match.score_home - 1)}-${match.score_away}`,
    `${match.score_home}-${Math.max(0, match.score_away - 1)}`,
    `${match.score_away}-${match.score_home}`,
  ];
  for (const v of shuffle(variants, rng)) {
    if (v !== real && !fakes.has(v) && fakes.size < 3) fakes.add(v);
  }
  if (fakes.size < 3) return null;
  const allOptions = shuffle(
    [{ id: 'correct', label: real }, ...Array.from(fakes).map((f, i) => ({ id: `f${i}`, label: f }))],
    rng,
  );
  return {
    id: `q${qIdx}`,
    prompt: `Quel a été le score de ${home} - ${away} ?`,
    hint: `Match récent`,
    options: allOptions,
    correct_option_id: 'correct',
    context_href: `/matches/${match.id}`,
  };
}

function genWinnerQuestion(
  match: FinishedMatch,
  qIdx: number,
): QuizQuestion | null {
  if (!match.home_team || !match.away_team) return null;
  if (match.score_home === match.score_away) return null; // skip nuls
  const winner = match.score_home > match.score_away ? 'home' : 'away';
  return {
    id: `q${qIdx}`,
    prompt: `Qui a gagné ${match.home_team.name} contre ${match.away_team.name} ?`,
    hint: `Score final ${match.score_home}-${match.score_away}`,
    options: [
      { id: 'home', label: match.home_team.name },
      { id: 'draw', label: 'Match nul' },
      { id: 'away', label: match.away_team.name },
    ],
    correct_option_id: winner,
    context_href: `/matches/${match.id}`,
  };
}

type TopScorerPlayer = {
  player_id: number;
  goals: number | null;
  player: { id: number; name: string; current_team_id: number | null } | null;
  competition: { id: number; name: string } | null;
};

async function fetchTopScorersPool(supabase: Supa): Promise<{
  comp_name: string;
  comp_id: number;
  top: TopScorerPlayer[];
}[]> {
  const { data: comps } = await supabase
    .from('competitions')
    .select('id, name')
    .limit(20);
  if (!comps) return [];

  const out: { comp_name: string; comp_id: number; top: TopScorerPlayer[] }[] =
    [];
  for (const c of comps) {
    const { data } = await supabase
      .from('player_season_stats')
      .select(
        'player_id, goals, player:players(id, name, current_team_id), competition:competitions(id, name)',
      )
      .eq('competition_id', c.id)
      .order('goals', { ascending: false, nullsFirst: false })
      .limit(8);
    const top = ((data ?? []) as unknown as TopScorerPlayer[]).filter(
      (r) => r.goals != null && r.goals > 0 && r.player,
    );
    if (top.length >= 4) {
      out.push({ comp_name: c.name, comp_id: c.id, top });
    }
  }
  return out;
}

function genTopScorerQuestion(
  pool: { comp_name: string; top: TopScorerPlayer[] }[],
  rng: () => number,
  qIdx: number,
): QuizQuestion | null {
  if (pool.length === 0) return null;
  const compEntry = pool[Math.floor(rng() * pool.length)]!;
  const top = compEntry.top;
  const correct = top[0]!;
  if (!correct.player) return null;
  const distractors = top
    .slice(1)
    .filter((p) => p.player)
    .slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffle(
    [
      { id: 'correct', label: correct.player!.name },
      ...distractors.map((d, i) => ({ id: `d${i}`, label: d.player!.name })),
    ],
    rng,
  );
  return {
    id: `q${qIdx}`,
    prompt: `Qui est le meilleur buteur en ${compEntry.comp_name} cette saison ?`,
    hint: `${correct.goals} buts`,
    options,
    correct_option_id: 'correct',
    context_href: `/players/${correct.player!.id}`,
  };
}

type PlayerWithTeam = {
  id: number;
  name: string;
  current_team: { id: number; name: string } | null;
};

async function fetchPlayersWithTeams(supabase: Supa): Promise<PlayerWithTeam[]> {
  const { data } = await supabase
    .from('players')
    .select(
      'id, name, current_team:teams!players_current_team_id_fkey(id, name)',
    )
    .not('current_team_id', 'is', null)
    .limit(500);
  return ((data ?? []) as unknown as PlayerWithTeam[]).filter(
    (p) => p.current_team,
  );
}

function genPlayerClubQuestion(
  players: PlayerWithTeam[],
  rng: () => number,
  qIdx: number,
): QuizQuestion | null {
  if (players.length < 8) return null;
  const target = players[Math.floor(rng() * players.length)]!;
  if (!target.current_team) return null;
  const correctTeamId = target.current_team.id;
  const otherTeams = new Map<number, string>();
  for (const p of players) {
    if (p.current_team && p.current_team.id !== correctTeamId) {
      otherTeams.set(p.current_team.id, p.current_team.name);
    }
  }
  const distractorTeams = pick(
    Array.from(otherTeams.entries()),
    3,
    rng,
  );
  if (distractorTeams.length < 3) return null;
  const options = shuffle(
    [
      { id: 'correct', label: target.current_team.name },
      ...distractorTeams.map(([, name], i) => ({ id: `t${i}`, label: name })),
    ],
    rng,
  );
  return {
    id: `q${qIdx}`,
    prompt: `Dans quel club joue ${target.name} ?`,
    hint: null,
    options,
    correct_option_id: 'correct',
    context_href: `/players/${target.id}`,
  };
}

// ============================================================================
// Main : build the daily quiz
// ============================================================================

export function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function buildDailyQuiz(
  supabase: Supa,
  day: string = todayString(),
): Promise<DailyQuiz> {
  const rng = mulberry32(hashDay(day));

  const [finishedMatches, topPool, playerPool] = await Promise.all([
    fetchFinishedMatchPool(supabase),
    fetchTopScorersPool(supabase),
    fetchPlayersWithTeams(supabase),
  ]);

  const questions: QuizQuestion[] = [];
  let qIdx = 1;

  // 1 score question
  for (const m of shuffle(finishedMatches, rng)) {
    const q = genScoreQuestion(m, rng, qIdx);
    if (q) {
      questions.push(q);
      qIdx++;
      break;
    }
  }

  // 1 winner question
  for (const m of shuffle(finishedMatches, rng)) {
    const q = genWinnerQuestion(m, qIdx);
    if (q && !questions.some((qq) => qq.context_href === q.context_href)) {
      questions.push(q);
      qIdx++;
      break;
    }
  }

  // 1 top scorer question
  const topScorerQ = genTopScorerQuestion(topPool, rng, qIdx);
  if (topScorerQ) {
    questions.push(topScorerQ);
    qIdx++;
  }

  // 2 player-club questions
  let playerClubCount = 0;
  for (let i = 0; i < 10 && playerClubCount < 2; i++) {
    const q = genPlayerClubQuestion(playerPool, rng, qIdx);
    if (q && !questions.some((qq) => qq.context_href === q.context_href)) {
      questions.push(q);
      qIdx++;
      playerClubCount++;
    }
  }

  return { day, questions };
}

// ============================================================================
// Stats user (séries, total)
// ============================================================================

export type UserQuizStats = {
  total_attempts: number;
  best_score: number;
  average_score: number;
  current_streak: number; // jours consécutifs
};

export async function getUserQuizStats(
  supabase: Supa,
  userId: string,
): Promise<UserQuizStats> {
  const { data } = await supabase
    .from('user_quiz_attempts')
    .select('quiz_day, score')
    .eq('user_id', userId)
    .order('quiz_day', { ascending: false })
    .limit(60);
  const rows = (data ?? []) as { quiz_day: string; score: number }[];
  if (rows.length === 0)
    return {
      total_attempts: 0,
      best_score: 0,
      average_score: 0,
      current_streak: 0,
    };

  const best = Math.max(...rows.map((r) => r.score));
  const avg = Math.round(
    rows.reduce((s, r) => s + r.score, 0) / rows.length,
  );

  // Streak : days consecutifs jusqu'à aujourd'hui ou hier
  let streak = 0;
  const today = todayString();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  if (rows[0]!.quiz_day === today || rows[0]!.quiz_day === yesterday) {
    let cursor = rows[0]!.quiz_day;
    streak = 1;
    for (let i = 1; i < rows.length; i++) {
      const prevDate = new Date(cursor);
      prevDate.setDate(prevDate.getDate() - 1);
      const expected = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
      if (rows[i]!.quiz_day === expected) {
        streak++;
        cursor = expected;
      } else {
        break;
      }
    }
  }

  return {
    total_attempts: rows.length,
    best_score: best,
    average_score: avg,
    current_streak: streak,
  };
}
