import Image from 'next/image';
import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { HeaderSearchBox } from '@/components/shared/HeaderSearchBox';
import { Button, buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = Boolean(profile?.is_admin);
  }

  return (
    <header
      className="border-border sticky top-0 z-30 border-b backdrop-blur"
      style={{ backgroundColor: 'oklch(0.16 0.025 255 / 0.85)' }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="bg-primary inline-block size-2.5 rounded-full shadow-[0_0_12px_var(--primary)]"
            aria-hidden
          />
          <Image
            src="/logo.png"
            alt="Tactuo"
            width={120}
            height={66}
            className="h-7 w-auto"
            priority
          />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-3">
          <HeaderSearchBox />
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground hidden rounded-md px-3 py-1.5 sm:inline-block"
            >
              Matchs
            </Link>
            <Link
              href="/compare"
              className="text-muted-foreground hover:text-foreground hidden rounded-md px-3 py-1.5 sm:inline-block"
            >
              Comparer
            </Link>
            <Link
              href="/precision"
              className="text-muted-foreground hover:text-foreground hidden rounded-md px-3 py-1.5 sm:inline-block"
            >
              Précision IA
            </Link>
            <Link
              href="/quiz"
              className="text-muted-foreground hover:text-foreground hidden rounded-md px-3 py-1.5 sm:inline-block"
            >
              Quiz
            </Link>
            {user && (
              <>
                <Link
                  href="/favoris"
                  className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5"
                >
                  Favoris
                </Link>
                <Link
                  href="/account/historique"
                  className="text-muted-foreground hover:text-foreground hidden rounded-md px-3 py-1.5 sm:inline-block"
                >
                  Historique
                </Link>
              </>
            )}

            {user ? (
              <div className="flex items-center gap-2 pl-2">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="bg-primary/15 text-primary hover:bg-primary/25 hidden rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide uppercase sm:inline-block"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/account/notifications"
                  className="text-muted-foreground hover:text-foreground hidden rounded-md px-2 py-1.5 text-xs sm:inline-block"
                  title="Préférences notifications"
                >
                  {user.email}
                </Link>
                <form action={signOut}>
                  <Button type="submit" variant="ghost" size="sm">
                    Déconnexion
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-1 pl-2">
                <Link
                  href="/login"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Connexion
                </Link>
                <Link href="/signup" className={buttonVariants({ size: 'sm' })}>
                  S&apos;inscrire
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
