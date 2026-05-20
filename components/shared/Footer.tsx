export function Footer() {
  return (
    <footer className="border-border mt-12 border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs sm:flex-row">
        <p>
          <span className="text-foreground font-medium">Tactuo</span> ·
          L&apos;analyse foot augmentée par l&apos;IA.
        </p>
        <p>© {new Date().getFullYear()} Tactuo. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
