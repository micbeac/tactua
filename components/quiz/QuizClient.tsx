'use client';

import { CheckCircle2, Trophy, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { submitQuizAttempt } from '@/app/quiz/actions';
import { Button } from '@/components/ui/button';
import type { DailyQuiz, QuizQuestion } from '@/lib/data/quiz';

type Props = {
  quiz: DailyQuiz;
  is_logged_in: boolean;
};

type Answers = Record<string, string>; // question_id → option_id

export function QuizClient({ quiz, is_logged_in }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    correct_count: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  const handleSelect = (qid: string, oid: string) => {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [qid]: oid }));
  };

  const handleSubmit = () => {
    setError(null);
    let correct = 0;
    const details = quiz.questions.map((q) => {
      const chosen = answers[q.id] ?? null;
      const ok = chosen === q.correct_option_id;
      if (ok) correct++;
      return { q: q.id, chosen, ok };
    });
    const score = Math.round((correct / quiz.questions.length) * 100);
    setResult({ score, correct_count: correct });
    setSubmitted(true);

    if (is_logged_in) {
      startTransition(async () => {
        const res = await submitQuizAttempt({
          day: quiz.day,
          score,
          correct_answers: correct,
          total_questions: quiz.questions.length,
          details_json: details,
        });
        if (!res.ok && res.message !== 'already_attempted') {
          setError(res.message ?? 'Erreur à l’enregistrement');
        }
      });
    }
  };

  if (submitted && result) {
    return (
      <ResultView
        score={result.score}
        correct={result.correct_count}
        total={quiz.questions.length}
        questions={quiz.questions}
        answers={answers}
        is_logged_in={is_logged_in}
        saving={isPending}
        error={error}
      />
    );
  }

  return (
    <div className="space-y-5">
      {quiz.questions.map((q, idx) => (
        <QuestionCard
          key={q.id}
          index={idx}
          total={quiz.questions.length}
          question={q}
          selected={answers[q.id] ?? null}
          onSelect={(oid) => handleSelect(q.id, oid)}
          submitted={false}
        />
      ))}

      <div className="bg-card border-border sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border p-4">
        <p className="text-muted-foreground text-xs">
          {Object.keys(answers).length}/{quiz.questions.length} réponses
        </p>
        <Button onClick={handleSubmit} disabled={!allAnswered}>
          Valider mes réponses
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({
  index,
  total,
  question,
  selected,
  onSelect,
  submitted,
}: {
  index: number;
  total: number;
  question: QuizQuestion;
  selected: string | null;
  onSelect: (oid: string) => void;
  submitted: boolean;
}) {
  return (
    <section className="bg-card border-border rounded-2xl border p-5">
      <header className="mb-3">
        <p className="text-primary text-[10px] font-semibold tracking-widest uppercase">
          Question {index + 1} / {total}
        </p>
        <h3 className="mt-1 text-base font-semibold leading-snug">
          {question.prompt}
        </h3>
        {question.hint && (
          <p className="text-muted-foreground mt-1 text-xs">{question.hint}</p>
        )}
      </header>
      <ul className="grid gap-2">
        {question.options.map((opt) => {
          const isSelected = selected === opt.id;
          const isCorrect = submitted && opt.id === question.correct_option_id;
          const isWrong = submitted && isSelected && !isCorrect;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => onSelect(opt.id)}
                disabled={submitted}
                className={`border-border w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  isCorrect
                    ? 'border-primary/60 bg-primary/15 text-primary font-semibold'
                    : isWrong
                      ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                      : isSelected
                        ? 'border-primary/40 bg-primary/10'
                        : 'hover:border-primary/30 hover:bg-primary/5'
                } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{opt.label}</span>
                  {isCorrect && (
                    <CheckCircle2 className="text-primary size-4 shrink-0" aria-hidden />
                  )}
                  {isWrong && (
                    <XCircle className="size-4 shrink-0 text-rose-400" aria-hidden />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {submitted && question.context_href && (
        <Link
          href={question.context_href}
          className="text-primary mt-3 inline-block text-xs font-semibold hover:underline"
        >
          Voir la fiche →
        </Link>
      )}
    </section>
  );
}

function ResultView({
  score,
  correct,
  total,
  questions,
  answers,
  is_logged_in,
  saving,
  error,
}: {
  score: number;
  correct: number;
  total: number;
  questions: QuizQuestion[];
  answers: Answers;
  is_logged_in: boolean;
  saving: boolean;
  error: string | null;
}) {
  const grade =
    score === 100
      ? 'Sans-faute 🎉'
      : score >= 80
        ? 'Excellent'
        : score >= 60
          ? 'Bon score'
          : score >= 40
            ? 'Peut mieux faire'
            : 'À retenter';
  return (
    <div className="space-y-5">
      <section className="bg-primary/10 border-primary/20 rounded-2xl border p-6 text-center">
        <Trophy className="text-primary mx-auto mb-2 size-10" aria-hidden />
        <p className="text-muted-foreground text-xs uppercase tracking-wide">
          Ton score du jour
        </p>
        <p className="text-primary mt-1 text-5xl font-bold">
          {score}
          <span className="text-2xl">/100</span>
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {correct} / {total} bonnes réponses · {grade}
        </p>
        {is_logged_in && saving && (
          <p className="text-muted-foreground mt-2 text-xs">Enregistrement…</p>
        )}
        {is_logged_in && !saving && !error && (
          <p className="text-muted-foreground mt-2 text-xs">
            Score enregistré dans ton historique.
          </p>
        )}
        {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
        {!is_logged_in && (
          <p className="text-muted-foreground mt-2 text-xs">
            <Link href="/login?redirect=/quiz" className="text-primary font-semibold hover:underline">
              Connecte-toi
            </Link>{' '}
            pour sauvegarder ton score et garder ta série en vie.
          </p>
        )}
      </section>

      {questions.map((q, idx) => (
        <QuestionCard
          key={q.id}
          index={idx}
          total={questions.length}
          question={q}
          selected={answers[q.id] ?? null}
          onSelect={() => {}}
          submitted={true}
        />
      ))}
    </div>
  );
}
