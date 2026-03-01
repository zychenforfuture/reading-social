import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [formError, setFormError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendCodeMutation = useMutation({
    mutationFn: () => api.sendCode(email, 'reset_password'),
    onSuccess: () => {
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current!); return 0; }
          return c - 1;
        });
      }, 1000);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => api.resetPassword(email, code, password),
    onSuccess: () => {
      navigate('/login', { state: { reset: true } });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (password !== confirm) {
      setFormError('两次输入的密码不一致');
      return;
    }
    resetMutation.mutate();
  };

  const errorMsg = (() => {
    if (formError) return formError;
    const msg = (resetMutation.error as any)?.message || (sendCodeMutation.error as any)?.message || '';
    if (msg.includes('验证码错误')) return '验证码错误，请重新输入';
    if (msg.includes('已过期')) return '验证码已过期，请重新发送';
    if (msg.includes('未注册')) return '该邮箱未注册';
    return msg || '';
  })();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">共鸣阅读</h1>
          <p className="text-sm text-gray-400">共鸣阅读</p>
        </div>

        {errorMsg && (
          <p className="text-sm text-red-500 text-center">{errorMsg}</p>
        )}

        {sendCodeMutation.isSuccess && !resetMutation.isError && (
          <p className="text-sm text-green-600 text-center">验证码已发送，请查收邮件</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-400 transition"
          />

          {/* 验证码行 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="邮箱验证码"
              required
              maxLength={6}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-400 transition"
            />
            <button
              type="button"
              disabled={!email || countdown > 0 || sendCodeMutation.isPending}
              onClick={() => sendCodeMutation.mutate()}
              className="shrink-0 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:bg-gray-300 text-white text-sm font-medium px-4 transition"
            >
              {countdown > 0 ? `${countdown}s` : sendCodeMutation.isPending ? '…' : '发送'}
            </button>
          </div>

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

          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="再次输入密码"
              required
              className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 pr-10 text-sm outline-none focus:border-gray-400 transition ${
                confirm && confirm !== password ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={resetMutation.isPending}
            className="w-full rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium py-2.5 transition disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
          >
            {resetMutation.isPending ? '重置中…' : '↩ 重置密码'}
          </button>
        </form>

        <div className="text-sm text-gray-500">
          <Link to="/login" className="hover:text-gray-900 transition">返回登入</Link>
        </div>
      </div>
    </div>
  );
}
