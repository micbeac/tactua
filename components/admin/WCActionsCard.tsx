'use client';

import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  regenAllGroupPredictions,
  regenAllKnockoutPredictions,
} from '@/app/admin/cdm/actions';
import { Button } from '@/components/ui/button';

type Props = {
  has_assignments: boolean;
  has_predictions: boolean;
};

export function WCActionsCard({ has_assignments, has_predictions }: Props) {
  const [pendingGroups, startGroups] = useTransition();
  const [pendingKO, startKO] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function genGroups() {
    if (
      has_predictions &&
      !confirm(
        'Régénérer les 12 prédictions de groupe ? Les anciennes seront écrasées.',
      )
    )
      return;
    setFeedback(null);
    startGroups(async () => {
      const res = await regenAllGroupPredictions();
      setFeedback(
        res.ok
          ? `✓ ${res.ok_count} groupes générés (${res.errors} erreurs)`
          : `Erreur : ${res.message ?? 'inconnu'}`,
      );
    });
  }

  function genKnockout() {
    setFeedback(null);
    startKO(async () => {
      const res = await regenAllKnockoutPredictions();
      setFeedback(
        res.ok
          ? `✓ ${res.ok_count} matchs phase finale prédits (${res.errors} erreurs)`
          : `Erreur : ${res.message ?? 'inconnu'}`,
      );
    });
  }

  return (
    <section className="bg-card border-border rounded-2xl border p-5">
      <header className="mb-4 flex items-center gap-2">
        <Wand2 className="text-primary size-4" aria-hidden />
        <h3 className="text-sm font-semibold">Actions IA</h3>
      </header>

      {!has_assignments && (
        <div className="bg-amber-500/10 border-amber-500/30 mb-4 rounded-lg border p-3 text-xs">
          ⚠ Aucune équipe mappée à un groupe en base. Insère d&apos;abord
          les assignments dans <code>wc_group_assignments</code> (via SQL
          ou un script d&apos;import) avant de générer les pronos.
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={genGroups}
            disabled={pendingGroups || pendingKO || !has_assignments}
          >
            {pendingGroups ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            Générer les 12 pronos de groupe
          </Button>
          <span className="text-muted-foreground text-xs">
            ~$0,01 · ~30s
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={genKnockout}
            disabled={pendingGroups || pendingKO}
          >
            {pendingKO ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            Régen pronos matchs phase finale
          </Button>
          <span className="text-muted-foreground text-xs">
            ~$0,03 · ~1min · matchs avec 2 équipes connues uniquement
          </span>
        </div>
        {feedback && (
          <p
            className={`text-xs ${feedback.startsWith('✓') ? 'text-primary' : 'text-destructive'}`}
          >
            {feedback}
          </p>
        )}
      </div>
    </section>
  );
}
