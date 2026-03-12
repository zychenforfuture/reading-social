import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationBell() {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  return (
    <button
      onClick={() => navigate('/profile/messages')}
      className="relative inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-muted transition-colors"
      title="消息通知"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
