import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tantml:react-query';
import { api, timeAgo } from '../../lib/utils';
import { Search, Trash2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDocuments() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-documents', page, search, statusFilter],
    queryFn: () => api.getAdminDocuments({ page, limit: 20, search, status: statusFilter || undefined }),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdminDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-documents'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleDeleteDocument = (id: string, title: string) => {
    if (confirm(`确定要删除文档《${title}》吗？此操作不可撤销！`)) {
      deleteDocumentMutation.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">就绪</span>;
      case 'processing':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">处理中</span>;
      case 'error':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">错误</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">{status}</span>;
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
          <h1 className="text-2xl font-bold text-gray-900">文档管理</h1>
          <p className="text-gray-600 mt-1">管理所有用户上传的文档</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="搜索文档标题、上传者..."
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

        <div className="flex gap-2">
          <button
            onClick={() => { setStatusFilter(''); setPage(1); }}
            className={`px-4 py-2 rounded-lg ${statusFilter === '' ? 'bg-teal-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
          >
            全部
          </button>
          <button
            onClick={() => { setStatusFilter('ready'); setPage(1); }}
            className={`px-4 py-2 rounded-lg ${statusFilter === 'ready' ? 'bg-green-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
          >
            就绪
          </button>
          <button
            onClick={() => { setStatusFilter('processing'); setPage(1); }}
            className={`px-4 py-2 rounded-lg ${statusFilter === 'processing' ? 'bg-yellow-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
          >
            处理中
          </button>
          <button
            onClick={() => { setStatusFilter('error'); setPage(1); }}
            className={`px-4 py-2 rounded-lg ${statusFilter === 'error' ? 'bg-red-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
          >
            错误
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">文档</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">上传者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">字数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">评论</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="text-teal-600" size={20} />
                      <div className="max-w-md">
                        <Link
                          to={`/documents/${doc.id}`}
                          className="font-medium text-gray-900 hover:text-teal-600 line-clamp-1"
                        >
                          {doc.title}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-gray-900 font-medium">{doc.uploader}</div>
                      <div className="text-xs text-gray-500">{doc.uploader_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(doc.status)}</td>
                  <td className="px-6 py-4 text-gray-600">{doc.word_count?.toLocaleString() || 0}</td>
                  <td className="px-6 py-4 text-gray-600">{doc.comment_count || 0}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{timeAgo(doc.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.title)}
                        disabled={deleteDocumentMutation.isPending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="删除文档"
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
              共 {data.pagination.total} 个文档，第 {page} / {data.pagination.totalPages} 页
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
