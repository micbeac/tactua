import Link from 'next/link';
import { listUsers, type UserListFilters } from '@/lib/data/admin-users';

export const metadata = { title: 'Admin · Utilisateurs' };

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const statusLabels: Record<string, string> = {
  free: 'Free',
  trial: 'Trial',
  paid: 'Payant',
  admin_grant: 'Grant admin',
  suspended: 'Suspendu',
};

const statusClasses: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  trial: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  paid: 'bg-primary/15 text-primary border-primary/30',
  admin_grant: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  suspended: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
  ref?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, status, page: pageStr, ref } = await searchParams;
  const page = pageStr ? Math.max(1, Number(pageStr)) : 1;
  const filters: UserListFilters = {
    search: q,
    status: status as UserListFilters['status'],
    ref_code: ref,
  };
  const { rows, total } = await listUsers(filters, page, 25);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Utilisateurs</h2>
          <p className="text-muted-foreground text-xs">
            {total} comptes au total
          </p>
        </div>
        <form
          method="get"
          className="bg-card border-border flex items-center gap-2 rounded-lg border p-2"
        >
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Email ou username…"
            className="bg-background border-border h-8 w-56 rounded-md border px-2 text-sm outline-none"
          />
          <select
            name="status"
            defaultValue={status ?? ''}
            className="bg-background border-border h-8 rounded-md border px-2 text-sm"
          >
            <option value="">Tous</option>
            <option value="free">Free</option>
            <option value="trial">Trial</option>
            <option value="paid">Payant</option>
            <option value="admin_grant">Grant admin</option>
            <option value="suspended">Suspendu</option>
          </select>
          <input
            type="text"
            name="ref"
            defaultValue={ref ?? ''}
            placeholder="Ref code"
            className="bg-background border-border h-8 w-28 rounded-md border px-2 text-sm"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/80 h-8 rounded-md px-3 text-xs font-semibold"
          >
            Filtrer
          </button>
        </form>
      </div>

      <div className="bg-card border-border overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-[10px] tracking-wide uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-left">Ref</th>
              <th className="px-3 py-2 text-left">Inscrit</th>
              <th className="px-3 py-2 text-left">Dernière connexion</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-border border-t">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {r.is_admin && (
                      <span className="bg-primary/20 text-primary rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        Admin
                      </span>
                    )}
                    <span className="font-medium">{r.email ?? '—'}</span>
                  </div>
                  {r.username && (
                    <p className="text-muted-foreground text-xs">
                      @{r.username}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusClasses[r.subscription_status]}`}
                  >
                    {statusLabels[r.subscription_status]}
                  </span>
                  {r.subscription_expires_at && (
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      jusqu&apos;au{' '}
                      {DATE_FMT.format(new Date(r.subscription_expires_at))}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.signup_ref_code ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  {DATE_FMT.format(new Date(r.created_at))}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  {r.last_seen_at
                    ? DATE_FMT.format(new Date(r.last_seen_at))
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/users/${r.id}`}
                    className="text-primary text-xs font-semibold hover:underline"
                  >
                    Détail →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-3 py-8 text-center text-sm"
                >
                  Aucun utilisateur trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs">
        <p className="text-muted-foreground">
          Page {page} · {Math.ceil(total / 25)} pages
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/admin/users?page=${page - 1}${q ? `&q=${q}` : ''}${status ? `&status=${status}` : ''}`}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
            >
              ← Précédent
            </Link>
          )}
          {page * 25 < total && (
            <Link
              href={`/admin/users?page=${page + 1}${q ? `&q=${q}` : ''}${status ? `&status=${status}` : ''}`}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
            >
              Suivant →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
