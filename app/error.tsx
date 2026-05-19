'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error.tsx]', error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-primary text-xs font-semibold tracking-widest uppercase">
        Erreur inattendue
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Quelque chose s&apos;est cassé.
      </h1>
      <p className="text-muted-foreground max-w-md text-sm">
        On a noté l&apos;erreur de notre côté. Tu peux essayer de recharger la
        page — si ça persiste, on regardera ça vite.
      </p>
      {error.digest && (
        <p className="text-muted-foreground/70 font-mono text-[10px]">
          ref : {error.digest}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>Réessayer</Button>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
