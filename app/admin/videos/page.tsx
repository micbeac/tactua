import Image from 'next/image';
import { DeleteVideoClipButton } from '@/components/admin/DeleteVideoClipButton';
import { VideoClipForm } from '@/components/admin/VideoClipForm';
import { youtubeThumbnail } from '@/lib/data/video-clips';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ENTITY_LABELS: Record<string, string> = {
  match: 'Match',
  player: 'Joueur',
  team: 'Club',
  news: 'Article',
};

type ClipRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  youtube_id: string;
  title: string;
  created_at: string;
};

export default async function AdminVideosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('video_clips')
    .select('id, entity_type, entity_id, youtube_id, title, created_at')
    .order('created_at', { ascending: false });
  const clips = (data ?? []) as ClipRow[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Vidéos
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Associe une vidéo YouTube à un match, un joueur, un club ou un
          article. Elle s&apos;affiche dans la section « Vidéos » de la page.
        </p>
      </header>

      <VideoClipForm />

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Vidéos enregistrées
          <span className="text-muted-foreground ml-1.5 font-normal">
            ({clips.length})
          </span>
        </h2>
        {clips.length === 0 ? (
          <p className="text-muted-foreground bg-card border-border rounded-xl border p-6 text-center text-sm">
            Aucune vidéo enregistrée pour le moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {clips.map((c) => (
              <li
                key={c.id}
                className="bg-card border-border flex items-center gap-3 rounded-lg border p-2"
              >
                <div className="bg-muted relative aspect-video w-28 shrink-0 overflow-hidden rounded">
                  <Image
                    src={youtubeThumbnail(c.youtube_id)}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {ENTITY_LABELS[c.entity_type] ?? c.entity_type} #
                    {c.entity_id} · {c.youtube_id}
                  </p>
                </div>
                <DeleteVideoClipButton id={c.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
