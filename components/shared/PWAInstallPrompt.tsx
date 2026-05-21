'use client';

import { Download, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

// Type pour beforeinstallprompt (pas standard dans TypeScript par défaut)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const STORAGE_KEY = 'tactuo-pwa-dismiss';
const VISITS_KEY = 'tactuo-visits';
const MIN_VISITS = 2; // Afficher uniquement après 2 visites
const COOLDOWN_DAYS = 7; // Si dismissed, ne pas re-proposer avant 7j

function isIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'standalone' in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    isIOSStandalone()
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function bumpVisitCounter(): number {
  try {
    const n = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1;
    localStorage.setItem(VISITS_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

function wasRecentlyDismissed(): boolean {
  try {
    const ts = Number(localStorage.getItem(STORAGE_KEY) ?? '0');
    if (!ts) return false;
    return Date.now() - ts < COOLDOWN_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((e) => console.warn('[pwa] SW register failed', e));
    }

    if (isPWAInstalled()) {
      setInstalled(true);
      return;
    }

    bumpVisitCounter();
    const visits = Number(localStorage.getItem(VISITS_KEY) ?? '0');

    if (visits < MIN_VISITS || wasRecentlyDismissed()) return;

    // Chrome/Android : event natif
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS : pas d'event natif, on affiche un tuto custom si on est sur iOS
    if (isIOS() && !isIOSStandalone()) {
      setShowIOSPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Listen for installed event
  useEffect(() => {
    const handler = () => setInstalled(true);
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  if (installed) return null;

  // === Variante Android/Chrome : prompt natif disponible ===
  if (installEvent) {
    return (
      <div className="bg-card border-border fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border p-4 shadow-2xl sm:left-auto sm:right-4">
        <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Smartphone className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Installer Tactuo</p>
          <p className="text-muted-foreground text-xs">
            Accès direct depuis ton écran d&apos;accueil
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await installEvent.prompt();
            const choice = await installEvent.userChoice;
            if (choice.outcome === 'accepted') {
              setInstalled(true);
            } else {
              markDismissed();
            }
            setInstallEvent(null);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-md px-3 py-2 text-xs font-semibold"
        >
          Installer
        </button>
        <button
          type="button"
          onClick={() => {
            markDismissed();
            setInstallEvent(null);
          }}
          aria-label="Fermer"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  // === Variante iOS : tuto custom ===
  if (showIOSPrompt) {
    return (
      <div className="bg-card border-border fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border p-4 shadow-2xl sm:left-auto sm:right-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
            <Download className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Installer Tactuo sur ton iPhone</p>
            <ol className="text-muted-foreground mt-2 list-decimal pl-4 text-xs leading-relaxed">
              <li>
                Touche le bouton{' '}
                <span className="text-primary font-semibold">Partager</span> en
                bas de l&apos;écran Safari
              </li>
              <li>
                Choisis{' '}
                <span className="text-primary font-semibold">
                  Sur l&apos;écran d&apos;accueil
                </span>
              </li>
              <li>Valide avec « Ajouter »</li>
            </ol>
          </div>
          <button
            type="button"
            onClick={() => {
              markDismissed();
              setShowIOSPrompt(false);
            }}
            aria-label="Fermer"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
