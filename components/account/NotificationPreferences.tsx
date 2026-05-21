'use client';

import { Check, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export type NotificationPreferencesProps = {
  initial_enabled: boolean;
};

export function NotificationPreferences({
  initial_enabled,
}: NotificationPreferencesProps) {
  const [enabled, setEnabled] = useState(initial_enabled);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');
      const next = !enabled;
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ daily_digest_enabled: next })
        .eq('id', user.id);
      if (upErr) throw upErr;
      setEnabled(next);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border-border flex items-start gap-3 rounded-xl border p-5">
        <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Mail className="size-5" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Digest matinal</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Reçois chaque matin un résumé personnalisé : matchs du jour des
            équipes que tu suis, résultats de la veille et news fraîches.
          </p>
        </div>
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          onClick={toggle}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
          ) : enabled ? (
            <Check className="mr-1 size-3.5" aria-hidden />
          ) : null}
          {enabled ? 'Activé' : 'Désactivé'}
        </Button>
      </div>

      {savedAt && (
        <p className="text-primary text-xs">
          ✓ Préférences sauvegardées
        </p>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}

      <p className="text-muted-foreground/70 text-xs leading-relaxed">
        Tactuo n&apos;utilise ton email que pour les notifications que tu choisis.
        Aucune publicité, jamais de revente à des tiers.
      </p>
    </div>
  );
}
