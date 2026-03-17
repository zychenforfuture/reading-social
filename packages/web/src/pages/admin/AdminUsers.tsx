import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, timeAgo } from '../../lib/utils';
import { Search, Trash2, Shield, ShieldOff, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => api.getAdminUsers({ page, limit: 20, search }),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: ({ id, is_admin }: { id: string; is_admin: boolean }) =>
      api.updateAdminUser(id, { is_admin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdminUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleToggleAdmin = (id: string, currentStatus: boolean) => {
    if (confirm(`确定要${currentStatus ? '取消' : '授予'}管理员权限吗？`)) {
      toggleAdminMutation.mutate({ id, is_admin: !currentStatus });
    }
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (confirm(`确定要删除用户 ${username} 吗？此操作不可撤销！`)) {
      deleteUserMutation.mutate(id);
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
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-600 mt-1">管理所有用户和权限</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="搜索用户名或邮箱..."
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

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">文档</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">评论</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">注册时间</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold">
                        {user.username[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    {user.is_admin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        <Shield size={12} />
                        管理员
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        普通用户
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.document_count}</td>
                  <td className="px-6 py-4 text-gray-600">{user.comment_count}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{timeAgo(user.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.is_admin || false)}
                        disabled={toggleAdminMutation.isPending}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                        title={user.is_admin ? '取消管理员' : '设为管理员'}
                      >
                        {user.is_admin ? <ShieldOff size={18} /> : <Shield size={18} />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        disabled={deleteUserMutation.isPending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="删除用户"
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
              共 {data.pagination.total} 个用户，第 {page} / {data.pagination.totalPages} 页
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
