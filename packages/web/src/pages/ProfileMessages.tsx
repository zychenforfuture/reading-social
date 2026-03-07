import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, type Notification } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, Trash2, CheckCheck, Filter } from 'lucide-react';

const NOTIFICATION_ICONS: Record<string, string> = {
  reply: '💬',
  mention: '📣',
  like: '❤️',
  system: '🔔',
};

const NOTIFICATION_TITLES: Record<string, string> = {
  reply: '回复通知',
  mention: '提及通知',
  like: '点赞通知',
  system: '系统通知',
};

type FilterType = 'all' | 'unread' | 'read';

export default function ProfileMessagesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // 筛选通知
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  // 切换选择
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条通知吗？`)) return;

    for (const id of selectedIds) {
      await deleteNotification(id);
    }
    setSelectedIds(new Set());
  };

  // 批量标记已读
  const handleBatchMarkRead = async () => {
    if (selectedIds.size === 0) return;

    for (const id of selectedIds) {
      await markAsRead(id);
    }
    setSelectedIds(new Set());
  };

  // 刷新列表
  const handleRefresh = async () => {
    await fetchNotifications();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/profile')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">我的消息</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                未读：<span className="font-medium text-teal-600">{unreadCount}</span>
              </span>
              <button
                onClick={handleRefresh}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="刷新"
              >
                🔄
              </button>
            </div>
          </div>

          {/* 筛选 Tab */}
          <div className="flex items-center gap-2 mt-3">
            <Filter className="w-4 h-4 text-gray-400" />
            {(['all', 'unread', 'read'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  filter === f
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? '全部' : f === 'unread' ? '未读' : '已读'}
                {f === 'unread' && unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      {selectedIds.size > 0 && (
        <div className="bg-teal-50 border-b border-teal-200 sticky top-14 z-10">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-teal-700 font-medium">
              已选择 {selectedIds.size} 条
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchMarkRead}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-100 rounded-lg transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                标记已读
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500">
              {filter === 'unread' ? '没有未读消息' : filter === 'read' ? '没有已读消息' : '暂无消息'}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
              >
                查看全部消息
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => toggleSelect(notification.id)}
                className={`relative bg-white rounded-xl p-4 cursor-pointer transition-all border-2 ${
                  selectedIds.has(notification.id)
                    ? 'border-teal-500 bg-teal-50'
                    : notification.is_read
                    ? 'border-gray-100 hover:border-gray-200'
                    : 'border-teal-100 bg-blue-50/30 hover:border-teal-200'
                }`}
              >
                {/* 选择框 */}
                <div className="absolute top-4 left-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(notification.id)
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedIds.has(notification.id) && '✓'}
                  </div>
                </div>

                <div className="flex gap-3 pl-8">
                  {/* 图标 */}
                  <div className="flex-shrink-0 text-2xl">
                    {NOTIFICATION_ICONS[notification.type] || '🔔'}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={`font-medium ${
                            !notification.is_read
                              ? 'text-gray-900'
                              : 'text-gray-700'
                          }`}
                        >
                          {notification.title}
                        </p>
                        {notification.content && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.content}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </span>
                    </div>

                    {/* 标签 */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                        {NOTIFICATION_TITLES[notification.type]}
                      </span>
                      {!notification.is_read && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-teal-100 text-teal-700 font-medium">
                          未读
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 底部操作 */}
        {filteredNotifications.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              全部标记已读
            </button>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                查看全部
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
