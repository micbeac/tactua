import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UserActionsForm } from '@/components/admin/UserActionsForm';
import { getUserDetail } from '@/lib/data/admin-users';

export const metadata = { title: 'Admin · Détail utilisateur' };

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/users"
            className="text-muted-foreground hover:text-foreground mb-2 inline-block text-xs"
          >
            ← Liste utilisateurs
          </Link>
          <h2 className="text-xl font-semibold">{user.email ?? user.id}</h2>
          <p className="text-muted-foreground text-xs">
            Inscrit le {DATE_FMT.format(new Date(user.created_at))}
            {user.last_seen_at &&
              ` · dernière connexion ${DATE_FMT.format(new Date(user.last_seen_at))}`}
            {user.signup_ref_code && ` · ref ${user.signup_ref_code}`}
          </p>
        </div>
      </header>

      {/* Stats user */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Analyses générées" value={user.analyses_generated} />
        <Stat label="Analyses consultées" value={user.analyses_viewed} />
        <Stat
          label="Quiz joués"
          value={user.quiz_attempts}
          hint={
            user.best_quiz_score != null
              ? `Meilleur : ${user.best_quiz_score}/100`
              : undefined
          }
        />
        <Stat label="Favoris" value={user.favorites_count} />
      </section>

      {/* Form actions */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <h3 className="mb-4 text-sm font-semibold">Abonnement & accès</h3>
        <UserActionsForm
          user_id={user.id}
          initial_status={user.subscription_status}
          initial_expires_at={user.subscription_expires_at}
          initial_notes={user.subscription_notes}
          initial_is_admin={user.is_admin}
        />
      </section>

      {/* Recent events */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <h3 className="mb-3 text-sm font-semibold">
          Activité récente · 20 derniers événements
        </h3>
        {user.recent_events.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Aucune activité enregistrée
          </p>
        ) : (
          <ul className="space-y-1.5">
            {user.recent_events.map((e, i) => (
              <li
                key={i}
                className="border-border/30 flex items-center justify-between gap-3 border-b py-1.5 text-xs last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    {e.action}
                  </span>
                  <span>
                    {e.analysis_type === 'pre_match' ? 'Pré-match' : 'Post-match'}{' '}
                    ·{' '}
                    <Link
                      href={`/matches/${e.match_id}`}
                      className="text-primary hover:underline"
                    >
                      match #{e.match_id}
                    </Link>
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {DATE_FMT.format(new Date(e.at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="bg-card border-border rounded-xl border p-3">
      <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}
