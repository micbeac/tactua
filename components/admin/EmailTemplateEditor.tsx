'use client';

import { useState, useTransition } from 'react';
import { sendTestEmail, upsertEmailTemplate } from '@/app/admin/actions';

type Props = {
  initial: {
    id: number;
    key: string;
    subject: string;
    body_md: string;
    description: string | null;
    is_active: boolean;
  };
  current_user_email: string | null;
};

export function EmailTemplateEditor({ initial, current_user_email }: Props) {
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body_md);
  const [description, setDescription] = useState(initial.description ?? '');
  const [isActive, setIsActive] = useState(initial.is_active);
  const [testEmail, setTestEmail] = useState(current_user_email ?? '');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await upsertEmailTemplate({
        id: initial.id,
        key: initial.key,
        subject,
        body_md: body,
        description: description.trim() || null,
        is_active: isActive,
      });
      setFeedback(res.ok ? '✓ Enregistré' : `Erreur : ${res.message}`);
    });
  }

  function sendTest() {
    if (!testEmail) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await sendTestEmail(initial.id, testEmail);
      setFeedback(
        res.ok
          ? `✓ Email test envoyé à ${testEmail}`
          : `Erreur : ${res.message}`,
      );
    });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-muted-foreground text-xs">
          Description (notes internes)
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-muted-foreground text-xs">Sujet</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-muted-foreground text-xs">
          Corps (Markdown · variables{' '}
          <code className="bg-muted/40 rounded px-1">{`{{user_name}}`}</code>,{' '}
          <code className="bg-muted/40 rounded px-1">{`{{partner_name}}`}</code>{' '}
          remplacées à l&apos;envoi)
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="bg-background border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm font-mono"
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span>Template actif</span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-border/40 pt-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? '…' : 'Enregistrer'}
        </button>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@email.com"
            className="bg-background border-border h-9 w-56 rounded-md border px-2 text-sm"
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={pending || !testEmail}
            className="border-border hover:bg-muted rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Envoyer un test
          </button>
        </div>
        {feedback && (
          <span
            className={`text-xs ${feedback.startsWith('✓') ? 'text-primary' : 'text-destructive'}`}
          >
            {feedback}
          </span>
        )}
      </div>
    </div>
  );
}
