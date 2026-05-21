'use client';

import { useEffect } from 'react';

/**
 * Capture le paramètre `?ref=` à l'arrivée et le stocke dans un cookie
 * `tactuo_ref` pendant 30 jours. Le cookie est ensuite lu par le server
 * action de signup pour attribuer l'inscription à un partenaire.
 */
export function RefCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (!ref) return;
      const clean = ref.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
      if (!clean) return;
      const maxAge = 30 * 24 * 60 * 60;
      document.cookie = `tactuo_ref=${encodeURIComponent(clean)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
    } catch {
      // Silencieux
    }
  }, []);
  return null;
}
