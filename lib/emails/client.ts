import { Resend } from 'resend';

// Envoi depuis contact@tactuo.com — domaine vérifié sur Resend.
// Avantage : les utilisateurs qui répondent à une notif tombent dans ta boîte
// `contact@`, ce qui ouvre un canal de support naturel.
export const FROM = 'Tactuo <contact@tactuo.com>';

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
