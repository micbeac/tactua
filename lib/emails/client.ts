import { Resend } from 'resend';

// Domaine partagé Resend pour le MVP (envoi limité à l'email du compte
// Resend tant qu'on n'a pas vérifié un domaine custom). Une fois custom prêt,
// remplacer par "Tactua <notifs@tactua.app>" ou équivalent.
export const FROM = 'Tactua <onboarding@resend.dev>';

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquant.');
  }
  _resend = new Resend(apiKey);
  return _resend;
}
