import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, type User } from '../lib/utils';
import { useUserStore } from '../stores/userStore';
import { FileText } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useUserStore();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (isRegister) {
        return api.register(formData.email, formData.username, formData.password);
      } else {
        return api.login(formData.email, formData.password);
      }
    },
    onSuccess: (data) => {
      if (isRegister) {
        // 注册成功后自动登录
        api.login(formData.email, formData.password).then((loginData) => {
          login(loginData.user, (loginData as any).token);
          navigate('/');
        });
      } else {
        login(data.user, (data as any).token);
        navigate('/');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4" />
          <h2 className="text-3xl font-bold">
            {isRegister ? '创建账号' : '欢迎回来'}
          </h2>
          <p className="text-muted-foreground mt-2">
            跨文档协同评论系统
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-2">用户名</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="输入用户名"
                required={isRegister}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">邮箱</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="输入邮箱"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">密码</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="输入密码"
              required
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-primary/90 bg-primary h-10 px-4 py-2 text-primary-foreground"
          >
            {mutation.isPending ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <div className="text-center text-sm">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-primary hover:underline"
          >
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <p>提示：演示模式下密码不需要哈希</p>
        </div>
      </div>
    </div>
  );
}
