import { PartnerForm } from '@/components/admin/PartnerForm';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/site';

export const metadata = { title: 'Admin · Partenaires' };
export const dynamic = 'force-dynamic';

type PartnerRow = {
  id: number;
  name: string;
  slug: string;
  email: string | null;
  notes: string | null;
  commission_pct: number;
  is_active: boolean;
};

export default async function AdminPartnersPage() {
  const admin = createAdminClient();
  const { data: partners } = await admin
    .from('partners')
    .select('id, name, slug, email, notes, commission_pct, is_active')
    .order('name', { ascending: true });

  const rows = (partners ?? []) as PartnerRow[];

  // Stats agrégées par partenaire
  const partnerIds = rows.map((r) => r.id);
  const referralsByPartner = new Map<
    number,
    { signups: number; paying: number; commission_due: number }
  >();
  if (partnerIds.length > 0) {
    const { data: refs } = await admin
      .from('partner_referrals')
      .select('partner_id, became_paying_at, commission_due_eur')
      .in('partner_id', partnerIds);
    for (const r of (refs ?? []) as {
      partner_id: number;
      became_paying_at: string | null;
      commission_due_eur: number | null;
    }[]) {
      const e = referralsByPartner.get(r.partner_id) ?? {
        signups: 0,
        paying: 0,
        commission_due: 0,
      };
      e.signups++;
      if (r.became_paying_at) {
        e.paying++;
        e.commission_due += Number(r.commission_due_eur ?? 0);
      }
      referralsByPartner.set(r.partner_id, e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Partenaires</h2>
          <p className="text-muted-foreground text-xs">
            {rows.length} partenaire(s) · URL de tracking : {SITE_URL}/?ref=&lt;slug&gt;
          </p>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-card border-border overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-[10px] tracking-wide uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Partenaire</th>
              <th className="px-3 py-2 text-left">URL ref</th>
              <th className="px-3 py-2 text-right">Commission</th>
              <th className="px-3 py-2 text-right">Inscrits</th>
              <th className="px-3 py-2 text-right">Payants</th>
              <th className="px-3 py-2 text-right">Commission due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const stats = referralsByPartner.get(p.id) ?? {
                signups: 0,
                paying: 0,
                commission_due: 0,
              };
              const url = `${SITE_URL}/?ref=${p.slug}`;
              return (
                <tr key={p.id} className="border-border border-t align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium">{p.name}</p>
                    {p.email && (
                      <p className="text-muted-foreground text-xs">{p.email}</p>
                    )}
                    {!p.is_active && (
                      <span className="bg-rose-500/15 text-rose-300 mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                        Inactif
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <code className="bg-muted/40 rounded px-1.5 py-0.5">
                      {url}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {p.commission_pct}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {stats.signups}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {stats.paying}
                  </td>
                  <td className="text-primary px-3 py-2 text-right font-semibold tabular-nums">
                    {stats.commission_due.toFixed(2)} €
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-3 py-8 text-center text-sm"
                >
                  Aucun partenaire — créés-en un ci-dessous
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Création */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <h3 className="mb-4 text-sm font-semibold">Nouveau partenaire</h3>
        <PartnerForm />
      </section>

      {/* Édition */}
      {rows.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Édition</h3>
          {rows.map((p) => (
            <details
              key={p.id}
              className="bg-card border-border rounded-xl border p-4"
            >
              <summary className="cursor-pointer text-sm font-medium">
                {p.name} ({p.slug})
              </summary>
              <div className="mt-4">
                <PartnerForm initial={p} />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
