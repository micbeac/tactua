'use client';

import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PostMatchAnalysisSection } from '@/components/match/PostMatchAnalysisSection';
import { PreMatchAnalysisSection } from '@/components/match/PreMatchAnalysisSection';
import { Button } from '@/components/ui/button';
import type {
  DeepPreMatchAnalysis,
  PostMatchAnalysis,
  PreMatchAnalysis,
} from '@/lib/openai/types';

type AnalysisType = 'pre_match' | 'post_match';

type Props = {
  match_id: number;
  type: AnalysisType;
  is_logged_in: boolean;
  home_team_name: string;
  away_team_name: string;
  initial_analysis:
    | PreMatchAnalysis
    | DeepPreMatchAnalysis
    | PostMatchAnalysis
    | null;
  initial_generated_at: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function MatchAnalysisOnDemand({
  match_id,
  type,
  is_logged_in,
  home_team_name,
  away_team_name,
  initial_analysis,
  initial_generated_at,
}: Props) {
  const [analysis, setAnalysis] = useState<
    PreMatchAnalysis | DeepPreMatchAnalysis | PostMatchAnalysis | null
  >(initial_analysis);
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    initial_generated_at,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading =
    type === 'pre_match' ? 'Analyse pré-match' : 'Analyse post-match';
  const ctaLabel =
    type === 'pre_match'
      ? 'Analyser ce match avec l’IA'
      : 'Analyser le résultat avec l’IA';

  async function runAnalysis(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${match_id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.message ? ` — ${data.message}` : '';
        throw new Error(
          `${data?.error ?? 'Erreur lors de la génération'}${detail}`,
        );
      }
      setAnalysis(data.analysis);
      setGeneratedAt(data.generated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // === État : utilisateur non connecté ===
  if (!is_logged_in) {
    return (
      <section className="bg-card border-border rounded-2xl border p-6">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{heading}</h2>
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            <Sparkles className="size-3" aria-hidden />
            Analyse IA
          </span>
        </header>
        <div className="text-center">
          <p className="text-muted-foreground mb-4 text-sm">
            Connecte-toi pour générer l’analyse IA de ce match.
          </p>
          <Link href={`/login?redirect=/matches/${match_id}`}>
            <Button variant="default" size="sm">
              Se connecter
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  // === État : loading (peut superposer une analyse existante OU être l'écran initial) ===
  if (loading) {
    return (
      <section className="bg-card border-border rounded-2xl border p-6">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{heading}</h2>
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            <Sparkles className="size-3" aria-hidden />
            Analyse IA
          </span>
        </header>
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="text-primary size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">
            Analyse en cours, quelques secondes…
          </p>
        </div>
      </section>
    );
  }

  // === État : analyse présente ===
  if (analysis) {
    return (
      <div className="space-y-3">
        {type === 'pre_match' ? (
          <PreMatchAnalysisSection
            analysis={analysis as PreMatchAnalysis | DeepPreMatchAnalysis}
            home_team_name={home_team_name}
            away_team_name={away_team_name}
            generated_at={generatedAt ?? undefined}
          />
        ) : (
          <PostMatchAnalysisSection
            analysis={analysis as PostMatchAnalysis}
            home_team_name={home_team_name}
            away_team_name={away_team_name}
            generated_at={generatedAt ?? undefined}
          />
        )}
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-muted-foreground text-xs">
            {generatedAt
              ? `Générée le ${DATE_FMT.format(new Date(generatedAt))}`
              : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAnalysis(true)}
            disabled={loading}
          >
            <RefreshCw className="mr-1 size-3.5" aria-hidden />
            Demander une analyse actualisée
          </Button>
        </div>
        {error && (
          <p className="text-destructive px-1 text-xs">{error}</p>
        )}
      </div>
    );
  }

  // === État initial : pas encore d'analyse ===
  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{heading}</h2>
        <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          <Sparkles className="size-3" aria-hidden />
          Analyse IA
        </span>
      </header>
      <div className="text-center">
        <p className="text-muted-foreground mb-5 text-sm">
          {type === 'pre_match'
            ? 'Notre IA croise forme récente, confrontations directes et compositions pour te livrer une lecture tactique du match.'
            : 'Notre IA décrypte les faits marquants, l’homme du match et la lecture tactique du résultat.'}
        </p>
        <Button onClick={() => runAnalysis(false)} disabled={loading}>
          <Sparkles className="mr-2 size-4" aria-hidden />
          {ctaLabel}
        </Button>
        {error && (
          <p className="text-destructive mt-3 text-xs">{error}</p>
        )}
      </div>
    </section>
  );
}
