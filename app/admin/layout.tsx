import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser } from '@/lib/data/admin';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Utilisateurs' },
  { href: '/admin/cdm', label: 'CDM 2026' },
  { href: '/admin/partners', label: 'Partenaires' },
  { href: '/admin/promo-codes', label: 'Codes promo' },
  { href: '/admin/emails', label: 'Emails' },
  { href: '/admin/push', label: 'Push' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?redirect=/admin');
  if (!admin.is_admin) redirect('/');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary text-[10px] font-semibold tracking-widest uppercase">
              Backoffice
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin Tactuo
            </h1>
          </div>
          <span className="text-muted-foreground text-xs">{admin.email}</span>
        </div>
        <nav className="mt-4 flex flex-wrap gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md px-3 py-1.5 text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
