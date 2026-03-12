import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Trash2, MessageCircle, AtSign, Heart } from 'lucide-react';
import { api, type Notification } from '../lib/utils';
import { cn } from '../lib/utils';

type FilterMode = 'all' | 'unread' | 'read';

const PAGE_SIZE = 20;

function typeIcon(type: Notification['type']) {
  if (type === 'reply')   return <MessageCircle className="h-4 w-4 text-teal-500 flex-shrink-0" />;
  if (type === 'mention') return <AtSign       className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  if (type === 'like')    return <Heart        className="h-4 w-4 text-red-500  flex-shrink-0" />;
  return null;
}

export default function ProfileMessages() {
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const [filter, setFilter]     = useState<FilterMode>('all');
  const [page, setPage]         = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const queryParams = {
    unread: filter === 'all' ? undefined : filter === 'unread',
    limit:  PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter, page],
    queryFn: () => api.getNotifications(queryParams),
  });

  const notifications = data?.notifications ?? [];
  const total         = data?.total ?? 0;
  const totalPages    = Math.ceil(total / PAGE_SIZE);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  }

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: invalidate,
  });

  const deleteSingle = useMutation({
    mutationFn: (id: string) => api.deleteNotification(id),
    onSuccess: invalidate,
  });

  const markBatchRead = useMutation({
    mutationFn: (ids: string[]) => api.markNotificationsReadBatch(ids),
    onSuccess: () => { setSelected(new Set()); invalidate(); },
  });

  const deleteBatch = useMutation({
    mutationFn: (ids: string[]) => api.deleteNotificationsBatch(ids),
    onSuccess: () => { setSelected(new Set()); invalidate(); },
  });

  function handleClickNotification(n: Notification) {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.data?.documentId) navigate(`/documents/${n.data.documentId}`);
  }

  const allSelected = notifications.length > 0 && notifications.every(n => selected.has(n.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifications.map(n => n.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleFilterChange(f: FilterMode) {
    setFilter(f);
    setPage(0);
    setSelected(new Set());
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">消息通知</h1>
        <button
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
          className="text-sm text-teal-600 hover:text-teal-700 disabled:opacity-50"
        >
          全部已读
        </button>
      </div>

      {/* 筛选标签 */}
      <div className="flex gap-2 mb-4">
        {(['all', 'unread', 'read'] as FilterMode[]).map(f => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={cn(
              'px-3 py-1 text-sm rounded-full border transition-colors',
              filter === f
                ? 'bg-teal-500 text-white border-teal-500'
                : 'border-gray-200 hover:border-teal-400'
            )}
          >
            { f === 'all' ? '全部' : f === 'unread' ? '未读' : '已读' }
          </button>
        ))}
      </div>

      {/* 批量工具栏 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 p-2 bg-muted rounded-md text-sm">
          <span className="text-muted-foreground">已选 {selected.size} 条</span>
          <button
            onClick={() => markBatchRead.mutate(Array.from(selected))}
            disabled={markBatchRead.isPending}
            className="text-teal-600 hover:text-teal-700 disabled:opacity-50"
          >
            标记已读
          </button>
          <button
            onClick={() => deleteBatch.mutate(Array.from(selected))}
            disabled={deleteBatch.isPending}
            className="text-red-500 hover:text-red-600 disabled:opacity-50"
          >
            删除
          </button>
        </div>
      )}

      {/* 列表 */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">加载中…</div>
      ) : notifications.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <Bell className="h-10 w-10 opacity-30" />
          <p>暂无通知</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {/* 表头全选 */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="rounded"
            />
            <span>全选</span>
          </div>

          {notifications.map(n => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors',
                !n.is_read && 'bg-teal-50/40'
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(n.id)}
                onChange={() => toggleSelect(n.id)}
                onClick={e => e.stopPropagation()}
                className="mt-1 rounded flex-shrink-0"
              />

              <button
                className="flex-1 text-left min-w-0"
                onClick={() => handleClickNotification(n)}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {typeIcon(n.type)}
                  <span className={cn('text-sm font-medium truncate', !n.is_read && 'text-foreground', n.is_read && 'text-muted-foreground')}>
                    {n.title}
                  </span>
                </div>
                {n.content && (
                  <p className="text-xs text-muted-foreground line-clamp-2 ml-6">{n.content}</p>
                )}
                {n.data?.documentTitle && (
                  <p className="text-xs text-teal-600 ml-6 mt-0.5 truncate">《{n.data.documentTitle}》</p>
                )}
                <p className="text-xs text-muted-foreground ml-6 mt-1">
                  {new Date(n.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>

              {/* 未读蓝点 */}
              {!n.is_read && (
                <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
              )}

              {/* 单条删除 */}
              <button
                onClick={() => deleteSingle.mutate(n.id)}
                disabled={deleteSingle.isPending}
                className="mt-0.5 text-muted-foreground hover:text-red-500 flex-shrink-0 disabled:opacity-40"
                title="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6 text-sm">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-muted"
          >
            上一页
          </button>
          <span className="text-muted-foreground">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-muted"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
