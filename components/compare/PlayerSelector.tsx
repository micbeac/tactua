'use client';

import { Loader2, Search, User as UserIcon, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type PlayerSelectorProps = {
  initial_player_id?: number | null;
  slot: 'a' | 'b';
};

type Suggestion = {
  id: number;
  name: string;
  photo_url: string | null;
  position: string | null;
  team_name: string | null;
};

export function PlayerSelector({
  initial_player_id,
  slot,
}: PlayerSelectorProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Charge le détail initial si pré-sélectionné
  useEffect(() => {
    if (!initial_player_id) return;
    (async () => {
      const supa = createClient();
      const { data } = await supa
        .from('players')
        .select(
          `id, name, photo_url, position,
           current_team:teams!players_current_team_id_fkey(name)`,
        )
        .eq('id', initial_player_id)
        .maybeSingle();
      if (data) {
        const team = (data as unknown as { current_team: { name: string } | null })
          .current_team;
        setSelected({
          id: data.id,
          name: data.name,
          photo_url: data.photo_url,
          position: data.position,
          team_name: team?.name ?? null,
        });
      }
    })();
  }, [initial_player_id]);

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
        .from('players')
        .select(
          `id, name, photo_url, position,
           current_team:teams!players_current_team_id_fkey(name)`,
        )
        .ilike('name', `%${query}%`)
        .not('photo_url', 'is', null)
        .order('name', { ascending: true })
        .limit(20);
      type Row = {
        id: number;
        name: string;
        photo_url: string | null;
        position: string | null;
        current_team: { name: string } | null;
      };
      setSuggestions(
        ((data ?? []) as unknown as Row[]).map((r) => ({
          id: r.id,
          name: r.name,
          photo_url: r.photo_url,
          position: r.position,
          team_name: r.current_team?.name ?? null,
        })),
      );
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Click outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  function pick(p: Suggestion) {
    setSelected(p);
    setQuery('');
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set(slot, String(p.id));
    window.history.replaceState(null, '', url);
    window.location.reload();
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
        Joueur {slot === 'a' ? 'A' : 'B'}
      </p>

      {selected ? (
        <button
          type="button"
          onClick={clear}
          className="bg-card hover:border-primary/40 border-border group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
        >
          <div className="bg-muted relative size-9 shrink-0 overflow-hidden rounded-full">
            {selected.photo_url ? (
              <Image
                src={selected.photo_url}
                alt=""
                fill
                sizes="36px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <UserIcon
                className="text-muted-foreground absolute inset-0 m-auto size-4"
                aria-hidden
              />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            {selected.team_name && (
              <p className="text-muted-foreground truncate text-[10px]">
                {selected.position
                  ? `${selected.position} · ${selected.team_name}`
                  : selected.team_name}
              </p>
            )}
          </div>
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
            placeholder="Rechercher un joueur..."
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
              <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-full">
                {s.photo_url ? (
                  <Image
                    src={s.photo_url}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <UserIcon
                    className="text-muted-foreground absolute inset-0 m-auto size-4"
                    aria-hidden
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.name}</p>
                {s.team_name && (
                  <p className="text-muted-foreground truncate text-[10px]">
                    {s.position ? `${s.position} · ${s.team_name}` : s.team_name}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
