import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, MessageSquare, ArrowLeft } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useEffect } from 'react';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUserStore();

  useEffect(() => {
    // Redirect if not authenticated or not admin
    if (!isAuthenticated || !user?.is_admin) {
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  const navItems = [
    { path: '/admin', label: '概览', icon: LayoutDashboard },
    { path: '/admin/users', label: '用户管理', icon: Users },
    { path: '/admin/documents', label: '文档管理', icon: FileText },
    { path: '/admin/comments', label: '评论管理', icon: MessageSquare },
  ];

  // Don't render if not authorized
  if (!isAuthenticated || !user?.is_admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="flex items-center gap-2 text-gray-600 hover:text-teal-600"
              >
                <ArrowLeft size={20} />
                返回主页
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <h1 className="text-xl font-bold text-gray-900">管理员面板</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                欢迎, <span className="font-medium text-gray-900">{user.username}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg border border-gray-200 p-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-teal-50 text-teal-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
