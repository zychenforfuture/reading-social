import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, type User } from '../lib/utils';
import { useUserStore } from '../stores/userStore';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useUserStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const successMsg = (location.state as any)?.registered
    ? '注册成功，请登录'
    : (location.state as any)?.reset
    ? '密码重置成功，请登录'
    : '';

  const mutation = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: (data) => {
      login(data.user as User, data.token);
      navigate('/');
    },
  });

  const errorMsg = (() => {
    const msg = (mutation.error as any)?.message || '';
    if (msg.includes('email_not_verified')) return '邮箱尚未验证，请先完成注册';
    if (msg.includes('Invalid credentials')) return '邮箱或密码错误';
    return msg || '登录失败，请稍后重试';
  })();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">共鸣阅读</h1>
          <p className="text-sm text-gray-400">共鸣阅读</p>
        </div>

        {successMsg && (
          <p className="text-sm text-green-600 text-center">{successMsg}</p>
        )}

        {mutation.isError && (
          <p className="text-sm text-red-500 text-center -mt-2">{errorMsg}</p>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-400 transition"
          />
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              required
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm outline-none focus:border-gray-400 transition"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium py-2.5 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? '登录中…' : '↩ 登入'}
          </button>
        </form>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex gap-3">
            <Link to="/register" className="hover:text-gray-900 transition">注册</Link>
            <Link to="/forgot-password" className="hover:text-gray-900 transition">忘记密码</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
