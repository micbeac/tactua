import Image from 'next/image';

export function Footer() {
  return (
    <footer
      className="border-border mt-12 border-t"
      style={{
        backgroundColor: 'oklch(0.16 0.025 255)',
        color: 'oklch(0.7 0.02 255)',
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs sm:flex-row">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Tactuo"
            width={80}
            height={44}
            className="h-8 w-auto"
            priority={false}
          />
          <span className="text-muted-foreground/80">
            · L&apos;analyse foot augmentée par l&apos;IA.
          </span>
        </div>
        <p>© {new Date().getFullYear()} Tactuo. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
