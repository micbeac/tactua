'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/data/admin';
import { createAdminClient } from '@/lib/supabase/admin';

async function assertAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await getAdminUser();
  if (!admin || !admin.is_admin) {
    return { ok: false, message: 'Accès refusé' };
  }
  return { ok: true };
}

// ============================================================================
// Users
// ============================================================================

type GrantPayload = {
  user_id: string;
  status: 'free' | 'trial' | 'paid' | 'admin_grant' | 'suspended';
  expires_at: string | null; // ISO date string or null
  notes: string | null;
};

export async function updateUserSubscription(
  payload: GrantPayload,
): Promise<{ ok: boolean; message?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({
      subscription_status: payload.status,
      subscription_expires_at: payload.expires_at,
      subscription_notes: payload.notes,
    })
    .eq('id', payload.user_id);
  if (error) {
    console.error('[admin] update subscription', error);
    return { ok: false, message: error.message };
  }
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${payload.user_id}`);
  return { ok: true };
}

export async function toggleAdminFlag(
  user_id: string,
  is_admin: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ is_admin })
    .eq('id', user_id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${user_id}`);
  return { ok: true };
}

export async function deleteUser(
  user_id: string,
): Promise<{ ok: boolean; message?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user_id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/users');
  return { ok: true };
}

// ============================================================================
// Partners
// ============================================================================

type PartnerPayload = {
  id?: number;
  name: string;
  slug: string;
  email: string | null;
  notes: string | null;
  commission_pct: number;
  is_active: boolean;
};

export async function upsertPartner(
  p: PartnerPayload,
): Promise<{ ok: boolean; message?: string; id?: number }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  if (p.id) {
    const { error } = await admin
      .from('partners')
      .update({
        name: p.name,
        slug: p.slug,
        email: p.email,
        notes: p.notes,
        commission_pct: p.commission_pct,
        is_active: p.is_active,
      })
      .eq('id', p.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/admin/partners');
    return { ok: true, id: p.id };
  }
  const { data, error } = await admin
    .from('partners')
    .insert({
      name: p.name,
      slug: p.slug,
      email: p.email,
      notes: p.notes,
      commission_pct: p.commission_pct,
      is_active: p.is_active,
    })
    .select('id')
    .single();
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/partners');
  return { ok: true, id: data?.id };
}

export async function deletePartner(
  id: number,
): Promise<{ ok: boolean; message?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin.from('partners').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/partners');
  return { ok: true };
}

// ============================================================================
// Promo codes
// ============================================================================

type PromoPayload = {
  id?: number;
  code: string;
  discount_type: 'percent' | 'fixed_eur';
  discount_value: number;
  partner_id: number | null;
  max_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
};

export async function upsertPromoCode(
  p: PromoPayload,
): Promise<{ ok: boolean; message?: string; id?: number }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  if (p.id) {
    const { error } = await admin
      .from('promo_codes')
      .update({
        code: p.code.toUpperCase(),
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        partner_id: p.partner_id,
        max_uses: p.max_uses,
        expires_at: p.expires_at,
        is_active: p.is_active,
        notes: p.notes,
      })
      .eq('id', p.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/admin/promo-codes');
    return { ok: true, id: p.id };
  }
  const { data, error } = await admin
    .from('promo_codes')
    .insert({
      code: p.code.toUpperCase(),
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      partner_id: p.partner_id,
      max_uses: p.max_uses,
      expires_at: p.expires_at,
      is_active: p.is_active,
      notes: p.notes,
    })
    .select('id')
    .single();
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/promo-codes');
  return { ok: true, id: data?.id };
}

export async function deletePromoCode(
  id: number,
): Promise<{ ok: boolean; message?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin.from('promo_codes').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/promo-codes');
  return { ok: true };
}

// ============================================================================
// Email templates
// ============================================================================

type TemplatePayload = {
  id?: number;
  key: string;
  subject: string;
  body_md: string;
  description: string | null;
  is_active: boolean;
};

export async function upsertEmailTemplate(
  t: TemplatePayload,
): Promise<{ ok: boolean; message?: string; id?: number }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = await getAdminUser();
  const adminClient = createAdminClient();
  const userId = admin?.user_id;
  if (t.id) {
    const { error } = await adminClient
      .from('email_templates')
      .update({
        key: t.key,
        subject: t.subject,
        body_md: t.body_md,
        description: t.description,
        is_active: t.is_active,
        updated_by: userId ?? null,
      })
      .eq('id', t.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/admin/emails');
    return { ok: true, id: t.id };
  }
  const { data, error } = await adminClient
    .from('email_templates')
    .insert({
      key: t.key,
      subject: t.subject,
      body_md: t.body_md,
      description: t.description,
      is_active: t.is_active,
      updated_by: userId ?? null,
    })
    .select('id')
    .single();
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/emails');
  return { ok: true, id: data?.id };
}

export async function sendTestEmail(
  templateId: number,
  recipient: string,
): Promise<{ ok: boolean; message?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const adminClient = createAdminClient();
  const { data: template } = await adminClient
    .from('email_templates')
    .select('subject, body_md')
    .eq('id', templateId)
    .maybeSingle();
  if (!template) return { ok: false, message: 'Template introuvable' };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@tactuo.com';
  if (!apiKey) {
    return { ok: false, message: 'RESEND_API_KEY non configurée' };
  }
  // Render basique : on remplace les variables par leurs noms (test seulement)
  const subject = `[TEST] ${template.subject}`;
  const html = template.body_md
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  const body = `<p>${html}</p>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipient,
        subject,
        html: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: `Resend: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
