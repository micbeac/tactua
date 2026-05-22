'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { youtubeThumbnail, type VideoClip } from '@/lib/data/video-clips';

export type VideoClipsSectionProps = {
  clips: VideoClip[];
  /** Titre de la section. Défaut "Vidéos". */
  title?: string;
};

/**
 * Section "Vidéos" : grille de miniatures légères. Au clic, la vidéo
 * s'ouvre dans une modale — l'iframe YouTube ne se charge QUE là, jamais
 * au chargement de la page.
 */
export function VideoClipsSection({
  clips,
  title = 'Vidéos',
}: VideoClipsSectionProps) {
  const [active, setActive] = useState<VideoClip | null>(null);

  if (clips.length === 0) return null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {clips.length} vidéo{clips.length > 1 ? 's' : ''}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((clip) => (
          <button
            key={clip.id}
            type="button"
            onClick={() => setActive(clip)}
            className="group block text-left"
          >
            <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
              {/* Miniature légère — pas d'iframe ici */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={youtubeThumbnail(clip.youtube_id)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/10">
                <span className="bg-primary/90 flex size-11 items-center justify-center rounded-full shadow-lg">
                  <Play
                    className="text-primary-foreground ml-0.5 size-5"
                    aria-hidden
                  />
                </span>
              </div>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm font-medium">
              {clip.title}
            </p>
          </button>
        ))}
      </div>

      <Dialog
        open={active != null}
        onOpenChange={(o) => {
          if (!o) setActive(null);
        }}
      >
        <DialogContent className="bg-card border-border max-w-3xl border p-0">
          <DialogTitle className="px-4 pt-4 text-sm font-semibold">
            {active?.title}
          </DialogTitle>
          {active && (
            <div className="aspect-video w-full overflow-hidden rounded-b-xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${active.youtube_id}?autoplay=1&rel=0`}
                title={active.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
