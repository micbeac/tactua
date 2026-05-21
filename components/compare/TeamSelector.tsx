'use client';

import { Loader2, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type TeamSelectorProps = {
  /** Valeur initiale en pré-sélection */
  initial_team_id?: number | null;
  /** Slot ('a' ou 'b' dans l'URL) */
  slot: 'a' | 'b';
  /** Quand l'user sélectionne une équipe, on update l'URL */
  onSelected?: (teamId: number) => void;
};

type Suggestion = { id: number; name: string; logo_url: string | null };

export function TeamSelector({
  initial_team_id,
  slot,
  onSelected,
}: TeamSelectorProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Charge le détail initial si pré-sélectionné
  useEffect(() => {
    if (!initial_team_id) return;
    (async () => {
      const supa = createClient();
      const { data } = await supa
        .from('teams')
        .select('id, name, logo_url')
        .eq('id', initial_team_id)
        .maybeSingle();
      if (data) setSelected(data as Suggestion);
    })();
  }, [initial_team_id]);

  // Debounce recherche
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const supa = createClient();
      const { data } = await supa
        .from('teams')
        .select('id, name, logo_url')
        .ilike('name', `%${query}%`)
        .not('api_football_id', 'is', null)
        .order('name', { ascending: true })
        .limit(20);
      setSuggestions((data ?? []) as Suggestion[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Click outside → close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  function pick(t: Suggestion) {
    setSelected(t);
    setQuery('');
    setOpen(false);
    if (onSelected) onSelected(t.id);
    else {
      // Update URL avec la sélection
      const url = new URL(window.location.href);
      url.searchParams.set(slot, String(t.id));
      window.history.replaceState(null, '', url);
      window.location.reload();
    }
  }

  function clear() {
    setSelected(null);
    setQuery('');
    const url = new URL(window.location.href);
    url.searchParams.delete(slot);
    window.history.replaceState(null, '', url);
    window.location.reload();
  }

  return (
    <div ref={boxRef} className="relative">
      <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
        Équipe {slot === 'a' ? 'A' : 'B'}
      </p>

      {selected ? (
        <button
          type="button"
          onClick={clear}
          className="bg-card hover:border-primary/40 border-border group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
        >
          <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-full">
            {selected.logo_url ? (
              <Image
                src={selected.logo_url}
                alt=""
                fill
                sizes="32px"
                className="object-contain p-0.5"
                unoptimized
              />
            ) : null}
          </div>
          <span className="flex-1 truncate text-left text-sm font-medium">
            {selected.name}
          </span>
          <X
            className="text-muted-foreground group-hover:text-foreground size-4 shrink-0"
            aria-hidden
          />
        </button>
      ) : (
        <div className="relative">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher une équipe..."
            className="bg-card border-border focus:border-primary/40 w-full rounded-lg border py-2.5 pr-3 pl-9 text-sm outline-none transition-colors"
          />
          {loading && (
            <Loader2
              className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
              aria-hidden
            />
          )}
        </div>
      )}

      {open && !selected && suggestions.length > 0 && (
        <div className="bg-popover border-border absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              className="hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
            >
              <div className="bg-muted relative size-7 shrink-0 overflow-hidden rounded-full">
                {s.logo_url ? (
                  <Image
                    src={s.logo_url}
                    alt=""
                    fill
                    sizes="28px"
                    className="object-contain p-0.5"
                    unoptimized
                  />
                ) : null}
              </div>
              <span className="text-sm">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
