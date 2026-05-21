'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Active le polling. À mettre à false si status != 'live'. */
  enabled: boolean;
  /** Intervalle de rafraichissement en secondes. Défaut 60s. */
  interval_seconds?: number;
};

/**
 * Force un refresh de la page (router.refresh) à intervalle régulier quand
 * le match est en cours. Permet d'afficher les nouveaux events / le score
 * mis à jour sans que l'utilisateur ait à recharger.
 *
 * Ne fait rien si la page est en arrière-plan (visibility hidden) pour
 * économiser le quota côté serveur.
 */
export function LiveAutoRefresh({
  enabled,
  interval_seconds = 60,
}: Props) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        setLastRefresh(new Date());
      }
    };
    // Premier tick après l'intervalle (évite le refresh immédiat au mount)
    timerRef.current = setInterval(tick, interval_seconds * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, interval_seconds, router]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-card/95 border border-border px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase shadow-lg backdrop-blur">
      <span className="bg-primary inline-block size-1.5 animate-pulse rounded-full" />
      <span>Live · refresh {interval_seconds}s</span>
      {lastRefresh && (
        <span className="text-muted-foreground/70 font-mono normal-case">
          {lastRefresh.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      )}
    </div>
  );
}
