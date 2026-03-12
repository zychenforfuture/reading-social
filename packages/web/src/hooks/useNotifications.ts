import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/utils';
import { useUserStore } from '../stores/userStore';

export function useNotifications() {
  const { isAuthenticated } = useUserStore();

  const { data, refetch } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.getUnreadNotificationCount(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  return { unreadCount: data?.count ?? 0, refetch };
}
