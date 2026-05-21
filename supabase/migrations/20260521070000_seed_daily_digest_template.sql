-- Seed du template daily_digest pour qu'il apparaisse dans /admin/emails.
-- Le sujet et les sections "intro"/"outro" du body sont utilisés par le cron
-- send-daily-digest. Le bloc {{items}} est remplacé par la liste générée
-- dynamiquement (matchs, résultats, news, suggestions).

insert into public.email_templates (key, subject, body_md, description)
values (
  'daily_digest',
  E'☕ Ton foot du jour — Tactuo',
  E'## {{greeting}}\n\nVoici ton foot du jour :\n\n{{items}}\n\nÀ tout de suite sur Tactuo !',
  E'Digest matinal envoyé chaque jour à 7h. Variables disponibles : {{greeting}} (salutation personnalisée), {{items}} (la liste de matchs/news/résultats générée automatiquement). Le HTML autour (header coloré, CTA, footer) reste géré par le code pour rester compatible Gmail/Outlook.'
)
on conflict (key) do nothing;
