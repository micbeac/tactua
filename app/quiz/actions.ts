'use server';

import { createClient } from '@/lib/supabase/server';

type Detail = { q: string; chosen: string | null; ok: boolean };

type Payload = {
  day: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  details_json: Detail[];
};

export async function submitQuizAttempt(
  payload: Payload,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'not_authenticated' };

  const { error } = await supabase.from('user_quiz_attempts').insert({
    user_id: user.id,
    quiz_day: payload.day,
    score: payload.score,
    total_questions: payload.total_questions,
    correct_answers: payload.correct_answers,
    details_json: payload.details_json,
  });

  if (error) {
    // Conflit unique (déjà tenté) → on considère le score précédent comme final.
    if (error.code === '23505') {
      return { ok: false, message: 'already_attempted' };
    }
    console.error('[quiz] insert error', error);
    return { ok: false, message: 'db_error' };
  }
  return { ok: true };
}
