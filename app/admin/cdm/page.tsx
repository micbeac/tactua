import { Globe, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';
import { WCActionsCard } from '@/components/admin/WCActionsCard';
import {
  getGroupPredictions,
  getGroupStandings,
} from '@/lib/data/world-cup';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Admin · CDM 2026' };
export const dynamic = 'force-dynamic';

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

export default async function AdminCDMPage() {
  const supabase = createAdminClient();
  const [standings, predictions] = await Promise.all([
    getGroupStandings(supabase),
    getGroupPredictions(supabase),
  ]);

  const totalTeamsAssigned = standings.reduce(
    (s, g) => s + g.teams.length,
    0,
  );
  const groupsWithPredictions = predictions.size;
  const knockoutPredsRes = await supabase
    .from('wc_knockout_predictions')
    .select('match_id', { count: 'exact', head: true });
  const knockoutCount = knockoutPredsRes.count ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Globe className="text-primary size-5" aria-hidden />
          Coupe du Monde 2026
        </h2>
        <p className="text-muted-foreground text-xs">
          Gestion des données et prédictions IA. Lien public :{' '}
          <Link
            href="/coupe-du-monde-2026"
            className="text-primary hover:underline"
          >
            /coupe-du-monde-2026
          </Link>
        </p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Équipes mappées"
          value={`${totalTeamsAssigned}/48`}
          icon={<Trophy className="size-4" />}
        />
        <KpiCard
          label="Groupes avec prono IA"
          value={`${groupsWithPredictions}/12`}
          icon={<Sparkles className="size-4" />}
        />
        <KpiCard
          label="Matchs phase finale prédits"
          value={String(knockoutCount)}
          icon={<Sparkles className="size-4" />}
        />
        <KpiCard
          label="Coût IA estimé"
          value="< 0,10 €"
          hint="12 groupes + ~30 KO @ gpt-4o-mini"
        />
      </section>

      {/* Actions */}
      <WCActionsCard
        has_assignments={totalTeamsAssigned > 0}
        has_predictions={groupsWithPredictions > 0}
      />

      {/* État des prédictions par groupe */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <h3 className="mb-3 text-sm font-semibold">État par groupe</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {standings.map((g) => {
            const pred = predictions.get(g.letter);
            return (
              <li
                key={g.letter}
                className="border-border flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold">Groupe {g.letter}</span>
                  <span className="text-muted-foreground text-xs">
                    {g.teams.length} équipes
                  </span>
                </div>
                {pred ? (
                  <span className="text-muted-foreground text-[10px]">
                    Prono : {DATE_FMT.format(new Date(pred.generated_at))}
                  </span>
                ) : (
                  <span className="bg-amber-500/15 text-amber-300 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    Sans prono
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}
