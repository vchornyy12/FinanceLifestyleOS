'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { WalletSchema } from '@/lib/schemas/wallet';

export async function createWallet(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { errors: { _: ['Unauthorized'] } };

  const parsed = WalletSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { error } = await supabase.from('wallets').insert({ ...parsed.data, user_id: user.id });
  if (error) return { errors: { _: [error.message] } };

  revalidatePath('/dashboard/wallets');
  return { success: true };
}

export async function updateWallet(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { errors: { _: ['Unauthorized'] } };

  const id = formData.get('id') as string;
  const entries = Object.fromEntries(formData);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = entries;
  const parsed = WalletSchema.safeParse(rest);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { credit_limit, ...updateData } = parsed.data;
  const { error } = await supabase
    .from('wallets')
    .update({ ...updateData, credit_limit: credit_limit ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { errors: { _: [error.message] } };

  revalidatePath('/dashboard/wallets');
  return { success: true };
}

export async function deleteWallet(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { errors: { _: ['Unauthorized'] } };

  const id = formData.get('id') as string;
  const { error } = await supabase.from('wallets').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { errors: { _: [error.message] } };

  revalidatePath('/dashboard/wallets');
  return { success: true };
}
