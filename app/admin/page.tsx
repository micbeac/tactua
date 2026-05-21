import type { Metadata } from 'next';
import {
  Activity,
  CheckCircle2,
  Eye,
  Heart,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  getConversionFunnel,
  getDashboardStats,
  getPlausibleStats,
} from '@/lib/data/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Admin · Dashboard' };

const FMT = new Intl.NumberFormat('fr-FR');

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const [stats, plausible, funnel7, funnel30] = await Promise.all([
    getDashboardStats(supabase),
    getPlausibleStats(),
    getConversionFunnel('7d'),
    getConversionFunnel('30d'),
  ]);

  return (
    <div className="space-y-8">
      {/* KPIs principaux */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<Users className="size-4" />}
          label="Inscrits"
          value={FMT.format(stats.total_users)}
        />
        <KpiCard
          icon={<UserPlus className="size-4" />}
          label="Nouveaux (7j)"
          value={FMT.format(stats.new_users_7d)}
          hint={`+${stats.new_users_30d} sur 30j`}
        />
        <KpiCard
          icon={<Activity className="size-4" />}
          label="Actifs (7j)"
          value={FMT.format(stats.active_users_7d)}
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Visiteurs (7j)"
          value={
            plausible.visitors_7d == null
              ? '—'
              : FMT.format(plausible.visitors_7d)
          }
          hint={
            plausible.pageviews_7d == null
              ? 'Configurer PLAUSIBLE_API_KEY'
              : `${FMT.format(plausible.pageviews_7d)} pages vues`
          }
        />
      </section>

      {/* Funnel */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold">
          Funnel de conversion
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FunnelCard funnel={funnel7} title="7 derniers jours" />
          <FunnelCard funnel={funnel30} title="30 derniers jours" />
        </div>
      </section>

      {/* Subscription breakdown */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold">
          Répartition par abonnement
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SubCard
            label="Free"
            value={stats.subscription_breakdown.free}
            color="muted"
          />
          <SubCard
            label="Trial"
            value={stats.subscription_breakdown.trial}
            color="amber"
          />
          <SubCard
            label="Payant"
            value={stats.subscription_breakdown.paid}
            color="primary"
          />
          <SubCard
            label="Grant admin"
            value={stats.subscription_breakdown.admin_grant}
            color="emerald"
          />
          <SubCard
            label="Suspendu"
            value={stats.subscription_breakdown.suspended}
            color="destructive"
          />
        </div>
      </section>

      {/* Activité 7j */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold">
          Activité produit (7j)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ActivityCard
            icon={<Sparkles className="size-4" />}
            label="Analyses générées"
            value={stats.activity_7d.analyses_generated}
          />
          <ActivityCard
            icon={<Eye className="size-4" />}
            label="Analyses consultées"
            value={stats.activity_7d.analyses_viewed}
          />
          <ActivityCard
            icon={<CheckCircle2 className="size-4" />}
            label="Quiz complétés"
            value={stats.activity_7d.quiz_completed}
          />
          <ActivityCard
            icon={<Heart className="size-4" />}
            label="Favoris ajoutés"
            value={stats.activity_7d.favorites_added}
          />
        </div>
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
  icon: React.ReactNode;
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
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}

function FunnelCard({
  funnel,
  title,
}: {
  funnel: Awaited<ReturnType<typeof getConversionFunnel>>;
  title: string;
}) {
  return (
    <div className="border-border rounded-lg border p-4">
      <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className="space-y-3">
        <FunnelRow
          label="Visiteurs uniques"
          value={funnel.visitors == null ? '—' : FMT.format(funnel.visitors)}
          pct={null}
        />
        <FunnelRow
          label="Inscrits"
          value={FMT.format(funnel.signups)}
          pct={funnel.visitor_to_signup_pct}
          pctLabel="des visiteurs"
        />
        <FunnelRow
          label="Payants (ou grant admin)"
          value={FMT.format(funnel.paying)}
          pct={funnel.signup_to_paying_pct}
          pctLabel="des inscrits"
        />
      </div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  pct,
  pctLabel,
}: {
  label: string;
  value: string;
  pct: number | null;
  pctLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-border/30 pb-2 last:border-b-0 last:pb-0">
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
      </div>
      {pct != null && (
        <p className="text-primary text-xs font-semibold">
          {pct}%{' '}
          {pctLabel && (
            <span className="text-muted-foreground font-normal">
              {pctLabel}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function SubCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'muted' | 'amber' | 'primary' | 'emerald' | 'destructive';
}) {
  const colorClass =
    color === 'primary'
      ? 'text-primary'
      : color === 'emerald'
        ? 'text-emerald-400'
        : color === 'amber'
          ? 'text-amber-300'
          : color === 'destructive'
            ? 'text-rose-400'
            : 'text-foreground';
  return (
    <div className="bg-background/40 border-border rounded-lg border p-3 text-center">
      <p className={`text-2xl font-bold tabular-nums ${colorClass}`}>
        {FMT.format(value)}
      </p>
      <p className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}

function ActivityCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="border-border rounded-lg border p-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">{FMT.format(value)}</p>
    </div>
  );
}
