import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { FileText, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useUserStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link to="/" className="mr-6 flex items-center space-x-2">
              <FileText className="h-6 w-6" />
              <span className="font-bold">共鸣阅读</span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link to="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
                文档列表
              </Link>
              {isAuthenticated && (
                <Link to="/profile" className="flex items-center gap-1.5 transition-colors hover:text-foreground/80 text-foreground/60">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-5 h-5 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center text-[10px] font-bold">
                      {(user?.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                  个人中心
                </Link>
              )}
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            {isAuthenticated ? (
              <>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted h-9 px-4 py-2"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-primary/90 bg-primary h-9 px-4 py-2 text-primary-foreground"
              >
                登录
              </Link>
            )}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b bg-background">
          <nav className="container py-4 space-y-4">
            <Link to="/" className="block text-sm font-medium">
              文档列表
            </Link>
            {isAuthenticated && (
              <Link to="/profile" className="block text-sm font-medium">
                个人中心
              </Link>
            )}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
