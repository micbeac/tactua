// Génère des angles vidéo TikTok pour les matchs récemment finis OU à venir
// dans les 48h, et insère les drafts dans content_angles.
//
// Auth : requireCronAuth (x-cron-secret = process.env.CRON_SECRET).
// Déclenchement : cron-job.org externe (Vercel Hobby plafonné à 2 crons),
// ou bouton admin via /admin/contenu.
//
// Vercel Hobby = 60s max, donc on traite 2-3 matchs par run grand max.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { runGenerateContentAngles } from '@/lib/content/generate-content-angles';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  const stats = await runGenerateContentAngles(supabase, {
    limit: 3,
    onProgress: (m) => console.log('[generate-content-angles]', m),
  });

  return NextResponse.json({ ok: true, stats });
}

export async function POST(request: Request) {
  return GET(request);
}
