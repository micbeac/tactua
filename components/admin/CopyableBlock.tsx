'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Bloc de texte/code avec bouton « Copier » et feedback visuel.
 * Réutilisable partout dans l'admin (livrables vidéo, prompts IA, etc.).
 */
export function CopyableBlock({
  label,
  value,
  language,
  mono,
}: {
  label?: string;
  value: string;
  /** Pour affichage en bloc code (style mono + fond). */
  mono?: boolean;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Si le navigateur refuse (HTTP, perms), fallback : select all
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* ignore */
      } finally {
        document.body.removeChild(el);
      }
    }
  }

  return (
    <div className="bg-card border-border rounded-lg border">
      <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
          {label ?? 'Texte'}
          {language && (
            <span className="text-muted-foreground/70 ml-2 font-normal">
              ({language})
            </span>
          )}
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void copy()}
          className="h-7 gap-1.5"
        >
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden />
              Copié
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden />
              Copier
            </>
          )}
        </Button>
      </div>
      <pre
        className={`max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs ${
          mono ? 'font-mono' : 'font-sans'
        }`}
      >
        {value}
      </pre>
    </div>
  );
}
