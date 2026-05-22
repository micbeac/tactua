import { WCNewsArticleCard } from '@/components/admin/WCNewsArticleCard';
import { WCNewsScrapeButton } from '@/components/admin/WCNewsScrapeButton';
import { getWCNewsAdmin } from '@/lib/data/wc-news';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function AdminWCNewsPage() {
  const supabase = createAdminClient();
  const articles = await getWCNewsAdmin(supabase);

  const drafts = articles.filter((a) => a.status === 'draft');
  const published = articles.filter((a) => a.status === 'published');
  const archived = articles.filter((a) => a.status === 'archived');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Actu Coupe du Monde
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Récupère, relis, édite puis publie les articles CDM. Seuls les
          articles publiés sont visibles sur le site.
        </p>
      </header>

      <WCNewsScrapeButton />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Brouillons" value={drafts.length} />
        <Stat label="Publiés" value={published.length} />
        <Stat label="Archivés" value={archived.length} />
      </div>

      {articles.length === 0 ? (
        <p className="text-muted-foreground bg-card border-border rounded-xl border p-6 text-center text-sm">
          Aucun article pour le moment. Lance le scraping pour en récupérer.
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Brouillons à relire" articles={drafts} />
          <Section title="Articles publiés" articles={published} />
          {archived.length > 0 && (
            <Section title="Archivés" articles={archived} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  articles,
}: {
  title: string;
  articles: Awaited<ReturnType<typeof getWCNewsAdmin>>;
}) {
  if (articles.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">
        {title}
        <span className="text-muted-foreground ml-1.5 font-normal">
          ({articles.length})
        </span>
      </h2>
      <ul className="space-y-3">
        {articles.map((a) => (
          <WCNewsArticleCard key={a.id} article={a} />
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
