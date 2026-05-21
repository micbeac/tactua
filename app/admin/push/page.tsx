import { Send } from 'lucide-react';
import { PushBroadcastForm } from '@/components/admin/PushBroadcastForm';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Admin · Notifications push' };
export const dynamic = 'force-dynamic';

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function AdminPushPage() {
  const admin = createAdminClient();

  // Compte les subscriptions actives
  const { count: subCount } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true });

  // Compte les broadcasts récents (logs admin_broadcast)
  const { count: broadcastCount } = await admin
    .from('push_log')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'admin_broadcast');

  // Derniers logs (toutes catégories)
  const { data: recentLogs } = await admin
    .from('push_log')
    .select('id, type, title, body, status, error, sent_at')
    .order('sent_at', { ascending: false })
    .limit(15);

  type LogRow = {
    id: number;
    type: string;
    title: string | null;
    body: string | null;
    status: string;
    error: string | null;
    sent_at: string;
  };
  const logs = (recentLogs ?? []) as LogRow[];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">Notifications push</h2>
        <p className="text-muted-foreground text-xs">
          {subCount ?? 0} abonné(s) · {broadcastCount ?? 0} broadcast(s) déjà
          envoyés
        </p>
      </header>

      {/* Form broadcast */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <header className="mb-4 flex items-center gap-2">
          <Send className="text-primary size-4" aria-hidden />
          <h3 className="text-sm font-semibold">Envoyer un broadcast</h3>
        </header>
        <PushBroadcastForm subscriber_count={subCount ?? 0} />
      </section>

      {/* Logs récents */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <h3 className="mb-3 text-sm font-semibold">15 derniers envois</h3>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-xs italic">
            Aucun envoi pour le moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li
                key={l.id}
                className="border-border/40 flex items-start justify-between gap-3 border-b py-2 text-xs last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                        l.status === 'sent'
                          ? 'bg-primary/15 text-primary'
                          : l.status === 'expired'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-destructive/15 text-destructive'
                      }`}
                    >
                      {l.status}
                    </span>
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                      {l.type}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-semibold">
                    {l.title ?? '—'}
                  </p>
                  {l.body && (
                    <p className="text-muted-foreground truncate">{l.body}</p>
                  )}
                  {l.error && (
                    <p className="text-destructive text-[10px]">{l.error}</p>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                  {DATE_FMT.format(new Date(l.sent_at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
