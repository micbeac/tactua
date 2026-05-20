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

  return (
    <header className="bg-background/80 border-border sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="bg-primary inline-block size-2.5 rounded-full shadow-[0_0_12px_var(--primary)]"
            aria-hidden
          />
          <span className="text-base font-semibold tracking-tight">Tactua</span>
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
            {user && (
              <Link
                href="/favoris"
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5"
              >
                Favoris
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2 pl-2">
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  {user.email}
                </span>
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
