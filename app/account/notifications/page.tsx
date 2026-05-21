import { redirect } from 'next/navigation';
import { NotificationPreferences } from '@/components/account/NotificationPreferences';
import { PushSubscribeButton } from '@/components/push/PushSubscribeButton';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ action?: string; token?: string }>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { action, token } = await searchParams;
  const supabase = await createClient();

  // Cas spécial : désinscription depuis lien email (token = user_id, validé
  // côté admin client). Permet de se désabonner même sans être loggé.
  if (action === 'unsubscribe' && token) {
    const admin = createAdminClient();
    await admin
      .from('profiles')
      .update({ daily_digest_enabled: false })
      .eq('id', token);
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <section className="bg-card border-border rounded-2xl border p-6 text-center">
          <h1 className="mb-3 text-xl font-semibold">
            Désabonnement confirmé ✓
          </h1>
          <p className="text-muted-foreground mb-4 text-sm">
            Tu ne recevras plus le digest matinal. Tu peux réactiver
            quand tu veux depuis tes préférences.
          </p>
          <a
            href="/"
            className="text-primary text-sm font-semibold hover:underline"
          >
            Retour à l&apos;accueil
          </a>
        </section>
      </main>
    );
  }

  // Affichage des préférences (auth requise)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/notifications');

  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_digest_enabled')
    .eq('id', user.id)
    .maybeSingle();

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Préférences notifications</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gère les emails et les notifications push de Tactuo.
        </p>
      </header>

      <section className="bg-card border-border rounded-2xl border p-5">
        <h2 className="mb-3 text-sm font-semibold">Notifications push</h2>
        {vapidKey ? (
          <PushSubscribeButton vapid_public_key={vapidKey} />
        ) : (
          <p className="text-muted-foreground text-xs italic">
            Les notifications push ne sont pas encore configurées sur ce
            déploiement.
          </p>
        )}
      </section>

      <section className="bg-card border-border rounded-2xl border p-5">
        <h2 className="mb-3 text-sm font-semibold">Email digest matinal</h2>
        <NotificationPreferences
          initial_enabled={profile?.daily_digest_enabled ?? true}
        />
      </section>
    </main>
  );
}
