import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/utils';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('验证链接无效，缺少 token 参数');
      return;
    }

    api
      .verifyEmail(token)
      .then((data) => {
        setStatus('success');
        setMessage(data.message || '邮箱验证成功，请登录');
      })
      .catch((err: any) => {
        setStatus('error');
        const msg: string = err?.message || '';
        if (msg.includes('Token expired')) {
          setMessage('验证链接已过期，请重新注册或联系管理员');
        } else if (msg.includes('already verified')) {
          setMessage('该邮箱已完成验证，请直接登录');
        } else if (msg.includes('Token not found')) {
          setMessage('验证链接无效或已使用，请检查邮件中的链接');
        } else {
          setMessage(msg || '验证失败，请稍后重试');
        }
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="h-16 w-16 mx-auto animate-spin text-muted-foreground" />
            <h2 className="text-2xl font-bold">验证中…</h2>
            <p className="text-muted-foreground">正在验证您的邮箱，请稍候</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold">验证成功！</h2>
            <p className="text-muted-foreground">{message}</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-primary/90 bg-primary h-10 px-6 py-2 text-primary-foreground"
            >
              前往登录
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold">验证失败</h2>
            <p className="text-muted-foreground">{message}</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input hover:bg-accent h-10 px-6 py-2"
            >
              返回登录
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
