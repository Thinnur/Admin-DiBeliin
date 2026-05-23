import { supabase } from '@/lib/supabase';

export interface AccountLog {
  id: string;
  account_id: string | null;
  account_phone: string;
  account_brand: string;
  user_email: string;
  action: AccountLogAction;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type AccountLogAction =
  | 'created'
  | 'deleted'
  | 'updated'
  | 'voucher_changed'
  | 'status_changed'
  | 'marked_in_use'
  | 'returned_to_ready';

interface CreateAccountLogParams {
  account_id: string | null;
  account_phone: string;
  account_brand: string;
  action: AccountLogAction;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function createAccountLog({
  account_id,
  account_phone,
  account_brand,
  action,
  description,
  metadata,
}: CreateAccountLogParams): Promise<void> {
  try {
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error(`[AccountLog] Auth error saat menulis log (${action} ${account_phone}):`, authError);
      return;
    }
    const user_email = data?.user?.email ?? 'unknown';

    const { error } = await supabase.from('account_logs').insert({
      account_id,
      account_phone,
      account_brand,
      user_email,
      action,
      description,
      metadata: metadata ?? null,
    });

    if (error) {
      console.error(`[AccountLog] Gagal tulis log (${action} ${account_phone}):`, error.message, error);
    }
  } catch (err) {
    console.error(`[AccountLog] Exception saat menulis log (${action} ${account_phone}):`, err);
  }
}

interface FetchAccountLogsParams {
  accountId?: string;
  action?: AccountLogAction;
  limit?: number;
}

export async function fetchAccountLogs({
  accountId,
  action,
  limit = 100,
}: FetchAccountLogsParams = {}): Promise<AccountLog[]> {
  let query = supabase
    .from('account_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (accountId) {
    query = query.eq('account_id', accountId);
  }
  if (action) {
    query = query.eq('action', action);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as AccountLog[];
}
