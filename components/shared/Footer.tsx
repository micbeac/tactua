export function Footer() {
  return (
    <footer
      className="border-border mt-12 border-t"
      style={{
        backgroundColor: 'oklch(0.16 0.025 255)',
        color: 'oklch(0.7 0.02 255)',
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs sm:flex-row">
        <p>
          <span style={{ color: 'oklch(0.985 0 0)' }} className="font-medium">
            Tactuo
          </span>{' '}
          · L&apos;analyse foot augmentée par l&apos;IA.
        </p>
        <p>© {new Date().getFullYear()} Tactuo. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
