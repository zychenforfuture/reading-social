import { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '../stores/userStore';

export interface Notification {
  id: string;
  type: 'reply' | 'mention' | 'system' | 'like';
  title: string;
  content?: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount?: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useUserStore();

  // 获取通知列表
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const url = unreadOnly 
        ? `${API_BASE}/notifications?unread=true`
        : `${API_BASE}/notifications`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch notifications');
      
      const data: NotificationsResponse = await res.json();
      setNotifications(data.notifications);
      if (data.unreadCount !== undefined) {
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 获取未读数量
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch unread count');
      
      const data = await res.json();
      setUnreadCount(data.count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [token]);

  // 标记为已读
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to mark as read');
      
      // 更新本地状态
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [token]);

  // 全部标记为已读
  const markAllAsRead = useCallback(async () => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to mark all as read');
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [token]);

  // 删除通知
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to delete notification');
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }, [token]);

  // 初始加载未读数量
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
