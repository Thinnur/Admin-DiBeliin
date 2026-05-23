import { useQuery } from '@tanstack/react-query';
import { fetchAccountLogs, type AccountLogAction } from '@/services/accountLogService';

interface UseAccountLogsParams {
  accountId?: string;
  action?: AccountLogAction;
  limit?: number;
}

export function useAccountLogs({ accountId, action, limit }: UseAccountLogsParams = {}) {
  return useQuery({
    queryKey: ['account_logs', { accountId, action, limit }],
    queryFn: () => fetchAccountLogs({ accountId, action, limit }),
    staleTime: 30_000,
  });
}
