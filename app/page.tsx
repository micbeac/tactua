import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { Button, buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

// Page d'accueil minimale orientée vérification d'auth.
// Sera retravaillée Jour 6 (vrai dashboard + matchs CDM).
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Tactua</h1>

      {user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground text-sm">
            Connecté en tant que{' '}
            <span className="text-foreground font-medium">{user.email}</span>
          </p>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Se déconnecter
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground text-sm">Pas connecté.</p>
          <div className="flex gap-3">
            <Link href="/login" className={buttonVariants()}>
              Se connecter
            </Link>
            <Link
              href="/signup"
              className={buttonVariants({ variant: 'outline' })}
            >
              S&apos;inscrire
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
