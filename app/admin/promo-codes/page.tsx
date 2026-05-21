import { PromoCodeForm } from '@/components/admin/PromoCodeForm';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Admin · Codes promo' };
export const dynamic = 'force-dynamic';

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

type CodeRow = {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed_eur';
  discount_value: number;
  partner_id: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  partners: { name: string } | null;
};

export default async function AdminPromoCodesPage() {
  const admin = createAdminClient();
  const [codesRes, partnersRes] = await Promise.all([
    admin
      .from('promo_codes')
      .select(
        'id, code, discount_type, discount_value, partner_id, max_uses, used_count, expires_at, is_active, notes, partners(name)',
      )
      .order('created_at', { ascending: false }),
    admin.from('partners').select('id, name').order('name'),
  ]);

  const codes = (codesRes.data ?? []) as unknown as CodeRow[];
  const partners = (partnersRes.data ?? []) as { id: number; name: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Codes promo</h2>
        <p className="text-muted-foreground text-xs">
          {codes.length} code(s) · Les codes liés à un partenaire déclenchent
          le calcul automatique de la commission au passage en payant.
        </p>
      </div>

      <div className="bg-card border-border overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-[10px] tracking-wide uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Réduction</th>
              <th className="px-3 py-2 text-left">Partenaire</th>
              <th className="px-3 py-2 text-right">Utilisations</th>
              <th className="px-3 py-2 text-left">Expire</th>
              <th className="px-3 py-2 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-border border-t">
                <td className="px-3 py-2">
                  <code className="bg-muted/40 rounded px-1.5 py-0.5 text-xs font-bold">
                    {c.code}
                  </code>
                  {c.notes && (
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      {c.notes}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-sm font-semibold">
                  {c.discount_type === 'percent'
                    ? `-${c.discount_value}%`
                    : `-${c.discount_value}€`}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  {c.partners?.name ?? '—'}
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">
                  {c.used_count}
                  {c.max_uses != null && (
                    <span className="text-muted-foreground"> / {c.max_uses}</span>
                  )}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  {c.expires_at
                    ? DATE_FMT.format(new Date(c.expires_at))
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  {c.is_active ? (
                    <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold">
                      Actif
                    </span>
                  ) : (
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-semibold">
                      Inactif
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {codes.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-3 py-8 text-center text-sm"
                >
                  Aucun code promo
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="bg-card border-border rounded-2xl border p-5">
        <h3 className="mb-4 text-sm font-semibold">Nouveau code promo</h3>
        <PromoCodeForm partners={partners} />
      </section>

      {codes.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Édition</h3>
          {codes.map((c) => (
            <details
              key={c.id}
              className="bg-card border-border rounded-xl border p-4"
            >
              <summary className="cursor-pointer text-sm font-medium">
                {c.code}
              </summary>
              <div className="mt-4">
                <PromoCodeForm
                  initial={{
                    id: c.id,
                    code: c.code,
                    discount_type: c.discount_type,
                    discount_value: Number(c.discount_value),
                    partner_id: c.partner_id,
                    max_uses: c.max_uses,
                    expires_at: c.expires_at,
                    is_active: c.is_active,
                    notes: c.notes,
                  }}
                  partners={partners}
                />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
