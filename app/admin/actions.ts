'use server';

import { revalidatePath } from 'next/cache';
import { setMomentStatus, insertAdminMoment } from '@/lib/db';

export async function reviewAction(formData: FormData) {
  const shortId = formData.get('shortId');
  const action = formData.get('action');
  if (typeof shortId !== 'string' || !shortId) return;
  if (action === 'restore') {
    await setMomentStatus(shortId, 'live');
  } else if (action === 'remove') {
    await setMomentStatus(shortId, 'removed');
  } else if (action === 'hide') {
    await setMomentStatus(shortId, 'hidden');
  }
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function createMomentAction(formData: FormData) {
  const text = formData.get('text');
  if (typeof text !== 'string') return;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 600) return;
  await insertAdminMoment(trimmed);
  revalidatePath('/admin');
  revalidatePath('/');
}
