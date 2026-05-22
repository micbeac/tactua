import { NextResponse } from 'next/server';
import { getMatchesForDay, isValidDate, todayParis } from '@/lib/matchday';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/matches/by-day?date=YYYY-MM-DD
 * Renvoie les matchs du jour demandé, groupés par compétition.
 * Utilisé par le bloc "Matchs du jour" de l'accueil (navigation jour + live).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const date =
    dateParam && isValidDate(dateParam) ? dateParam : todayParis();

  const supabase = await createClient();
  const groups = await getMatchesForDay(supabase, date);

  return NextResponse.json(
    { date, groups },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
