'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteVideoClip } from '@/app/admin/videos/actions';

export function DeleteVideoClipButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm('Supprimer cette vidéo ?')) return;
    setBusy(true);
    try {
      await deleteVideoClip(id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onDelete()}
      disabled={busy}
      className="text-destructive hover:bg-destructive/10 rounded-md px-2 py-1 text-xs transition-colors"
    >
      {busy ? '…' : 'Supprimer'}
    </button>
  );
}
