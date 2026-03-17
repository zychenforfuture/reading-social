import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, timeAgo } from '../../lib/utils';
import { Search, Trash2, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

export default function AdminComments() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-comments', page, search],
    queryFn: () => api.getAdminComments({ page, limit: 20, search }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdminComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleDeleteComment = (id: string) => {
    if (confirm('确定要删除此评论吗？此操作不可撤销！')) {
      deleteCommentMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">评论管理</h1>
          <p className="text-gray-600 mt-1">管理和审核所有评论</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="搜索评论内容、用户名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          搜索
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSearchInput('');
              setPage(1);
            }}
            className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            清除
          </button>
        )}
      </form>

      {/* Comments Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">评论内容</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">点赞</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">回复</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.comments.map((comment) => (
                <tr key={comment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="max-w-md">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="text-teal-600 flex-shrink-0 mt-1" size={16} />
                        <div>
                          <p className="text-gray-900 line-clamp-2">{comment.content}</p>
                          {comment.selected_text && (
                            <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">
                              引用: {comment.selected_text}
                            </p>
                          )}
                          {comment.block_content && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                              内容块: {comment.block_content.substring(0, 50)}...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-gray-900 font-medium">{comment.username}</div>
                      <div className="text-xs text-gray-500">{comment.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{comment.like_count}</td>
                  <td className="px-6 py-4 text-gray-600">{comment.reply_count}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{timeAgo(comment.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deleteCommentMutation.isPending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="删除评论"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              共 {data.pagination.total} 条评论，第 {page} / {data.pagination.totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                下一页
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
