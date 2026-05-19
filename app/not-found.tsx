import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-primary text-xs font-semibold tracking-widest uppercase">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Page introuvable
      </h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Le match, l&apos;équipe ou le joueur que tu cherches n&apos;existe pas
        (ou plus). Reviens à la page d&apos;accueil pour repartir des matchs CDM
        en cours.
      </p>
      <Link href="/" className={buttonVariants()}>
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
