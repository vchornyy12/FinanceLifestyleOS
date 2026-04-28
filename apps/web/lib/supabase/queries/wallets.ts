import type { SupabaseClient } from '@supabase/supabase-js';
import type { WalletWithBalance } from '@/types/database';

export async function getUserWalletsWithBalances(supabase: SupabaseClient): Promise<WalletWithBalance[]> {
  const { data: wallets, error } = await supabase.from('wallets').select('*').order('created_at');
  if (error) throw error;

  const results = await Promise.all(
    wallets.map(async (w) => {
      const { data } = await supabase.rpc('get_wallet_balance', { p_wallet_id: w.id });
      return { ...w, balance: data ?? w.opening_balance } as WalletWithBalance;
    })
  );
  return results;
}
