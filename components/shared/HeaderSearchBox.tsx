'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function HeaderSearchBox() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = q.trim();
    if (clean.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(clean)}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative hidden md:block">
      <Search
        className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher équipe ou joueur…"
        aria-label="Rechercher une équipe ou un joueur"
        className="bg-card border-border focus-visible:border-primary focus-visible:ring-primary/30 h-8 w-56 rounded-md border pr-3 pl-8 text-sm outline-none focus-visible:ring-2"
      />
    </form>
  );
}
