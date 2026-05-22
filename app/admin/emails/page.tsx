import { EmailTemplateEditor } from '@/components/admin/EmailTemplateEditor';
import { getAdminUser } from '@/lib/data/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Admin · Emails' };
export const dynamic = 'force-dynamic';

type Template = {
  id: number;
  key: string;
  subject: string;
  body_md: string;
  description: string | null;
  is_active: boolean;
  updated_at: string;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

const KEY_LABELS: Record<string, string> = {
  welcome: 'Email de bienvenue (post-signup)',
  daily_digest: 'Digest matinal (cron 7h)',
  partner_promo: 'Campagne partenaire / influenceur',
};

export default async function AdminEmailsPage() {
  const admin = createAdminClient();
  const currentAdmin = await getAdminUser();
  const { data: templates } = await admin
    .from('email_templates')
    .select(
      'id, key, subject, body_md, description, is_active, updated_at',
    )
    .order('key', { ascending: true });

  const rows = (templates ?? []) as Template[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Templates email</h2>
        <p className="text-muted-foreground text-xs">
          {rows.length} template(s) · Édite le sujet et le corps puis envoie-toi
          un test avant utilisation.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="bg-card border-border rounded-2xl border p-10 text-center text-sm text-muted-foreground">
          Aucun template. Les seeds n&apos;ont pas dû être appliqués lors de la
          migration.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((t) => (
            <section
              key={t.id}
              className="bg-card border-border rounded-2xl border p-5"
            >
              <header className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted/40 rounded px-1.5 py-0.5 text-xs font-bold">
                      {t.key}
                    </code>
                    {!t.is_active && (
                      <span className="bg-rose-500/15 text-rose-300 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Inactif
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">
                    {KEY_LABELS[t.key] ?? t.key}
                  </h3>
                </div>
                <p className="text-muted-foreground text-[10px]">
                  Modifié le {DATE_FMT.format(new Date(t.updated_at))}
                </p>
              </header>
              <EmailTemplateEditor
                initial={{
                  id: t.id,
                  key: t.key,
                  subject: t.subject,
                  body_md: t.body_md,
                  description: t.description,
                  is_active: t.is_active,
                }}
                current_user_email={currentAdmin?.email ?? null}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
