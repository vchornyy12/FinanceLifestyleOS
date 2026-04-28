'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WalletSchema } from '@/lib/schemas/wallet';
import { z } from 'zod';

export async function completeOnboarding(walletsJson: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const parsed = z.array(WalletSchema).safeParse(JSON.parse(walletsJson));
  if (parsed.success && parsed.data.length > 0) {
    await supabase.from('wallets').insert(parsed.data.map((w) => ({ ...w, user_id: user.id })));
  }

  await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
  revalidatePath('/dashboard');
  redirect('/dashboard/wallets');
}

export async function skipOnboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
  redirect('/dashboard');
}
