// Vérifie le header Authorization envoyé par Vercel Cron (ou un curl manuel).
// Vercel ajoute automatiquement `Authorization: Bearer ${CRON_SECRET}` quand
// CRON_SECRET est défini dans les env vars du projet.
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs

import { NextResponse } from 'next/server';

export function requireCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET non configuré côté serveur' },
      { status: 500 },
    );
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
