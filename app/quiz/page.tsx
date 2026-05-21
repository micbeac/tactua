import type { Metadata } from 'next';
import { Flame, Sparkles, Target, Trophy } from 'lucide-react';
import Link from 'next/link';
import { QuizClient } from '@/components/quiz/QuizClient';
import { buildDailyQuiz, getUserQuizStats, todayString } from '@/lib/data/quiz';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Défi du jour · Quiz Tactuo',
  description:
    'Teste tes connaissances football : 5 questions tirées au sort chaque jour, basées sur les vraies stats des championnats.',
};

// Quiz recalculé une fois par heure max (mais identique pour tous le même jour)
export const revalidate = 3600;

const FR_DAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export default async function QuizPage() {
  const supabase = await createClient();
  const day = todayString();
  const [quiz, authRes] = await Promise.all([
    buildDailyQuiz(supabase, day),
    supabase.auth.getUser(),
  ]);
  const user = authRes.data.user;
  const isLoggedIn = Boolean(user);

  // Vérifier si l'user a déjà tenté aujourd'hui
  let alreadyAttempted: {
    score: number;
    correct_answers: number;
    completed_at: string;
  } | null = null;
  let stats: Awaited<ReturnType<typeof getUserQuizStats>> | null = null;
  if (user) {
    const [existingRes, statsRes] = await Promise.all([
      supabase
        .from('user_quiz_attempts')
        .select('score, correct_answers, completed_at')
        .eq('user_id', user.id)
        .eq('quiz_day', day)
        .maybeSingle(),
      getUserQuizStats(supabase, user.id),
    ]);
    alreadyAttempted = existingRes.data ?? null;
    stats = statsRes;
  }

  const labelDay = FR_DAY.format(new Date(day));

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <p className="text-primary mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
          <Sparkles className="size-3.5" aria-hidden />
          Le défi du jour
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Quiz Tactuo</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          5 questions tirées au sort dans la base, pour {labelDay}. Reviens
          demain pour un nouveau défi.
        </p>
      </header>

      {/* Stats utilisateur */}
      {stats && stats.total_attempts > 0 && (
        <section className="grid gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Flame className="size-4" />}
            label="Série en cours"
            value={`${stats.current_streak} j`}
            highlight={stats.current_streak >= 3}
          />
          <StatCard
            icon={<Target className="size-4" />}
            label="Meilleur score"
            value={`${stats.best_score}/100`}
          />
          <StatCard
            icon={<Trophy className="size-4" />}
            label="Moyenne"
            value={`${stats.average_score}/100`}
          />
          <StatCard
            icon={<Sparkles className="size-4" />}
            label="Quiz joués"
            value={String(stats.total_attempts)}
          />
        </section>
      )}

      {/* Cas : déjà tenté aujourd'hui → afficher le résultat figé */}
      {alreadyAttempted ? (
        <section className="bg-primary/10 border-primary/20 rounded-2xl border p-6 text-center">
          <Trophy
            className="text-primary mx-auto mb-2 size-10"
            aria-hidden
          />
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Tu as déjà joué aujourd&apos;hui
          </p>
          <p className="text-primary mt-1 text-5xl font-bold">
            {alreadyAttempted.score}
            <span className="text-2xl">/100</span>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {alreadyAttempted.correct_answers} / {quiz.questions.length} bonnes
            réponses
          </p>
          <p className="text-muted-foreground mt-3 text-xs">
            Reviens demain à la même heure pour un nouveau quiz.
          </p>
          <Link
            href="/"
            className="text-primary mt-4 inline-block text-sm font-semibold hover:underline"
          >
            Retour à l&apos;accueil →
          </Link>
        </section>
      ) : quiz.questions.length === 0 ? (
        <section className="bg-card border-border rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Pas assez de données pour générer le quiz du jour. Reviens plus
            tard !
          </p>
        </section>
      ) : (
        <QuizClient quiz={quiz} is_logged_in={isLoggedIn} />
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-card rounded-xl border p-3 ${
        highlight ? 'border-primary/40' : 'border-border'
      }`}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          highlight ? 'text-primary' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
