import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/utils';
import { Users, FileText, MessageSquare, Package } from 'lucide-react';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.getAdminStats(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: '用户总数',
      value: stats?.users.total || 0,
      subtitle: `管理员: ${stats?.users.admins || 0}`,
      recent: `最近7天: +${stats?.users.recent || 0}`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: '文档总数',
      value: stats?.documents.total || 0,
      subtitle: `就绪: ${stats?.documents.ready || 0} / 处理中: ${stats?.documents.processing || 0}`,
      recent: `最近7天: +${stats?.documents.recent || 0}`,
      icon: FileText,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      title: '评论总数',
      value: stats?.comments.total || 0,
      subtitle: `最近7天: +${stats?.comments.recent || 0}`,
      recent: '',
      icon: MessageSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: '内容块总数',
      value: stats?.blocks.total || 0,
      subtitle: `总字数: ${stats?.documents.totalWords.toLocaleString() || 0}`,
      recent: '',
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统概览</h1>
        <p className="text-gray-600 mt-1">管理员控制面板</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{card.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
                {card.recent && <p className="text-xs text-teal-600 mt-1">{card.recent}</p>}
              </div>
              <div className={`${card.bgColor} ${card.color} p-3 rounded-lg`}>
                <card.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">文档状态分布</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">就绪</span>
              <span className="text-green-600 font-semibold">{stats?.documents.ready || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">处理中</span>
              <span className="text-yellow-600 font-semibold">{stats?.documents.processing || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">错误</span>
              <span className="text-red-600 font-semibold">{stats?.documents.error || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">活跃度统计</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">新增用户（7天）</span>
              <span className="text-blue-600 font-semibold">{stats?.users.recent || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">新增文档（7天）</span>
              <span className="text-teal-600 font-semibold">{stats?.documents.recent || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">新增评论（7天）</span>
              <span className="text-purple-600 font-semibold">{stats?.comments.recent || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
