'use client';

import { Star } from 'lucide-react';
import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { toggleFavorite } from '@/app/favoris/actions';
import { buttonVariants } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import type { FavoriteEntityType } from '@/lib/data/favorites';

export type FavoriteButtonProps = {
  entity_type: FavoriteEntityType;
  entity_id: number;
  is_favorite: boolean;
  is_logged_in: boolean;
  /** Petit pour la home / cards (icône seule), grand pour les fiches. */
  size?: 'sm' | 'md';
  /** Label custom (par défaut "Suivre" / "Suivi"). */
  label_add?: string;
  label_remove?: string;
};

export function FavoriteButton({
  entity_type,
  entity_id,
  is_favorite,
  is_logged_in,
  size = 'md',
  label_add = 'Suivre',
  label_remove = 'Suivi',
}: FavoriteButtonProps) {
  const [optimistic, setOptimistic] = useOptimistic(is_favorite);
  const [pending, startTransition] = useTransition();

  if (!is_logged_in) {
    return (
      <Link
        href="/login"
        className={buttonVariants({
          variant: 'outline',
          size: size === 'sm' ? 'sm' : 'default',
        })}
        title="Connecte-toi pour suivre"
      >
        <Star className="size-4" aria-hidden />
        <span>{label_add}</span>
      </Link>
    );
  }

  const onClick = () => {
    const wasFavorite = optimistic;
    startTransition(async () => {
      setOptimistic(!optimistic);
      const res = await toggleFavorite(entity_type, entity_id);
      if (!res.ok) {
        // Revert si échec serveur
        setOptimistic(is_favorite);
        return;
      }
      track(wasFavorite ? 'Favori retiré' : 'Favori ajouté', {
        entity_type,
      });
    });
  };

  const labelText = optimistic ? label_remove : label_add;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={optimistic}
      className={buttonVariants({
        variant: optimistic ? 'default' : 'outline',
        size: size === 'sm' ? 'sm' : 'default',
      })}
      title={optimistic ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Star
        className={`size-4 ${optimistic ? 'fill-current' : ''}`}
        aria-hidden
      />
      <span>{labelText}</span>
    </button>
  );
}
