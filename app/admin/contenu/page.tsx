import { ContentAngleCard } from '@/components/admin/ContentAngleCard';
import { ContentGenerateButton } from '@/components/admin/ContentGenerateButton';
import {
  getAllContentAngles,
  type ContentAngleRow,
} from '@/lib/data/content-angles';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const URGENCE_ORDER: Record<string, number> = {
  live: 0,
  '24h': 1,
  '72h': 2,
  evergreen: 3,
};

function sortAngles(a: ContentAngleRow, b: ContentAngleRow): number {
  // Score viralité DESC, puis urgence, puis date DESC
  const sa = a.score_viralite ?? 0;
  const sb = b.score_viralite ?? 0;
  if (sa !== sb) return sb - sa;
  const ua = URGENCE_ORDER[a.urgence ?? 'evergreen'] ?? 9;
  const ub = URGENCE_ORDER[b.urgence ?? 'evergreen'] ?? 9;
  if (ua !== ub) return ua - ub;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export default async function AdminContentPage() {
  const supabase = createAdminClient();
  const all = await getAllContentAngles(supabase);

  const pending = all.filter((a) => a.status === 'pending').sort(sortAngles);
  const validated = all
    .filter((a) => a.status === 'validated')
    .sort(sortAngles);
  const produced = all.filter((a) => a.status === 'produced').sort(sortAngles);
  const published = all
    .filter((a) => a.status === 'published')
    .sort(sortAngles);
  const rejected = all.filter((a) => a.status === 'rejected').sort(sortAngles);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Contenu à produire
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Angles vidéo TikTok générés par l&apos;IA depuis les matchs récents
          et à venir. Relis, valide, produis dans CapCut + ElevenLabs +
          Leonardo, puis renseigne l&apos;URL TikTok.
        </p>
      </header>

      <ContentGenerateButton />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="À valider" value={pending.length} />
        <Stat label="Validés" value={validated.length} />
        <Stat label="Produits" value={produced.length} />
        <Stat label="Publiés" value={published.length} />
        <Stat label="Rejetés" value={rejected.length} />
      </div>

      {all.length === 0 ? (
        <p className="text-muted-foreground bg-card border-border rounded-xl border p-6 text-center text-sm">
          Aucun angle pour le moment. Lance la génération pour créer des
          drafts depuis les matchs éligibles.
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="À valider (drafts récents)" angles={pending} />
          <Section title="Validés — à produire" angles={validated} />
          <Section title="Produits — à publier" angles={produced} />
          <Section title="Publiés" angles={published} />
          {rejected.length > 0 && (
            <Section title="Rejetés" angles={rejected} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  angles,
}: {
  title: string;
  angles: ContentAngleRow[];
}) {
  if (angles.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        {title}
        <span className="text-muted-foreground ml-1.5 font-normal">
          ({angles.length})
        </span>
      </h2>
      <ul className="space-y-3">
        {angles.map((a) => (
          <ContentAngleCard key={a.id} angle={a} />
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border-border rounded-xl border p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}
