import {
  NewsArticleCard,
  type AdminNewsArticle,
} from '@/components/admin/NewsArticleCard';
import { CATEGORY_LABELS, NEWS_CATEGORIES } from './actions';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Plafond d'articles chargés : au-delà la page devient inutilisable. */
const PAGE_SIZE = 60;

type SearchParams = Promise<{
  team?: string;
  category?: string;
  status?: string;
}>;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from('team_narratives')
    .select(
      `id, title, slug, category, status, meta_description, ai_summary,
       ai_content, ai_perspective, ai_generated_at, edited_at, scraped_at,
       url, video_youtube_id,
       team:teams!team_narratives_team_id_fkey(id, name)`,
    )
    .order('scraped_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (params.team) query = query.eq('team_id', Number(params.team));
  if (params.category) query = query.eq('category', params.category);
  if (params.status) query = query.eq('status', params.status);

  const { data } = await query;
  const articles = (data ?? []) as unknown as AdminNewsArticle[];

  // Liste des équipes ayant au moins un article, pour le filtre.
  const { data: teamRows } = await supabase
    .from('team_narratives')
    .select('team:teams!team_narratives_team_id_fkey(id, name)')
    .limit(2000);

  const teamsById = new Map<number, string>();
  for (const r of (teamRows ?? []) as unknown as Array<{
    team: { id: number; name: string } | null;
  }>) {
    if (r.team) teamsById.set(r.team.id, r.team.name);
  }
  const teams = [...teamsById.entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );

  const uncategorised = articles.filter((a) => !a.category).length;
  const pending = articles.filter((a) => !a.ai_content).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Actualités clubs
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Relis, corrige et publie les articles générés. Les {PAGE_SIZE} plus
          récents sont affichés.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 text-xs">
        <Stat label="Affichés" value={articles.length} />
        <Stat label="Sans catégorie" value={uncategorised} warn={uncategorised > 0} />
        <Stat label="À rédiger" value={pending} warn={pending > 0} />
      </div>

      <form className="border-border flex flex-wrap items-end gap-3 rounded-xl border p-3">
        <Filter label="Équipe" name="team" value={params.team ?? ''}>
          <option value="">Toutes</option>
          {teams.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Filter>
        <Filter label="Catégorie" name="category" value={params.category ?? ''}>
          <option value="">Toutes</option>
          {NEWS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Filter>
        <Filter label="Statut" name="status" value={params.status ?? ''}>
          <option value="">Tous</option>
          <option value="published">Publié</option>
          <option value="draft">Brouillon</option>
          <option value="archived">Archivé</option>
        </Filter>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium"
        >
          Filtrer
        </button>
      </form>

      {articles.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun article ne correspond à ces filtres.
        </p>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <NewsArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <span className="text-muted-foreground">
      {label} :{' '}
      <strong className={warn ? 'text-amber-400' : 'text-foreground'}>
        {value}
      </strong>
    </span>
  );
}

function Filter({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-[10px] tracking-wide uppercase">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="bg-background border-border rounded-md border px-2 py-1.5 text-sm"
      >
        {children}
      </select>
    </label>
  );
}
