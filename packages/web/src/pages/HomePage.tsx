import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Document } from '../lib/utils';
import { useUserStore } from '../stores/userStore';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, Plus, Upload } from 'lucide-react';
import { useState, useRef } from 'react';

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useUserStore();
  const queryClient = useQueryClient();
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [readProgress, setReadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.getDocuments(),
    enabled: isAuthenticated,
    // 有文档处于"处理中"时每 3 秒自动刷新
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.documents?.some((d: Document) => d.status === 'processing');
      return hasProcessing ? 3000 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string }) =>
      api.createDocument(data.title, data.content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowCreateForm(false);
      setNewDocTitle('');
      setNewDocContent('');
      setUploadError('');
      setReadProgress(null);
    },
    onError: (err: Error) => {
      setUploadError(`上传失败：${err.message}`);
      setReadProgress(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim() || !newDocContent.trim()) return;
    createMutation.mutate({ title: newDocTitle, content: newDocContent });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    if (!file.name.toLowerCase().endsWith('.txt')) {
      setUploadError('仅支持 .txt 格式的文件');
      e.target.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('文件大小不能超过 50MB');
      e.target.value = '';
      return;
    }

    e.target.value = '';

    // 终止上一个 worker（如果有）
    workerRef.current?.terminate();

    const worker = new Worker(
      new URL('../workers/fileProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;
    setReadProgress(0);

    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg.type === 'PROGRESS') {
        setReadProgress(msg.progress as number);
      } else if (msg.type === 'DONE') {
        setReadProgress(100);
        worker.terminate();
        workerRef.current = null;
        createMutation.mutate({ title: msg.title as string, content: msg.content as string });
      } else if (msg.type === 'ERROR') {
        setUploadError(`文件读取失败：${msg.message}`);
        setReadProgress(null);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = () => {
      setUploadError('文件读取失败，请重试');
      setReadProgress(null);
    };

    worker.postMessage({ type: 'PROCESS_FILE', file });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-4xl font-bold mb-4">欢迎使用 共鸣阅读</h1>
        <p className="text-muted-foreground mb-8 text-center max-w-md">
          跨文档协同评论系统 - 评论跟着内容走，而不是跟着文档走
        </p>
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-primary/90 bg-primary h-10 px-8 text-primary-foreground"
        >
          开始使用
        </button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">我的文档</h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={createMutation.isPending || readProgress !== null}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-secondary/80 bg-secondary h-9 px-4 py-2 text-secondary-foreground disabled:opacity-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            上传 TXT
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-primary/90 bg-primary h-9 px-4 py-2 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建文档
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {uploadError}
        </div>
      )}

      {(readProgress !== null || createMutation.isPending) && (
        <div className="rounded-md border bg-card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {readProgress !== null && readProgress < 100
                ? `正在读取文件… ${readProgress}%`
                : createMutation.isPending
                ? '正在上传并处理文档…'
                : '完成'}
            </span>
            <span className="text-xs text-muted-foreground">
              {readProgress !== null && readProgress < 100
                ? `${readProgress}%`
                : createMutation.isPending
                ? '处理中'
                : ''}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-200"
              style={{
                width:
                  readProgress !== null && readProgress < 100
                    ? `${readProgress}%`
                    : '100%',
                opacity: createMutation.isPending && readProgress === 100 ? undefined : undefined,
              }}
            />
          </div>
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-6 bg-card">
          <div>
            <label className="block text-sm font-medium mb-2">标题</label>
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="输入文档标题"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">内容</label>
            <textarea
              value={newDocContent}
              onChange={(e) => setNewDocContent(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[200px]"
              placeholder="输入文档内容..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-primary/90 bg-primary h-9 px-4 py-2 text-primary-foreground"
            >
              {createMutation.isPending ? '创建中...' : '创建'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted h-9 px-4 py-2"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.documents.length === 0 ? (
          <div className="col-span-full text-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无文档，创建一个开始使用吧</p>
          </div>
        ) : (
          data?.documents.map((doc: Document) => (
            <div
              key={doc.id}
              className="rounded-lg border bg-card p-4 space-y-2 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-lg truncate flex-1">{doc.title}</h3>
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {user?.is_admin && doc.uploader && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="bg-muted rounded px-1.5 py-0.5">上传者</span>
                  <span className="font-medium text-foreground">{doc.uploader}</span>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{doc.word_count || 0} 字</span>
                <span>{doc.block_count || 0} 块</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    doc.status === 'ready'
                      ? 'bg-green-100 text-green-700'
                      : doc.status === 'processing'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {doc.status === 'ready' ? '就绪' : doc.status === 'processing' ? '处理中' : '错误'}
                </span>
              </div>
              <button
                onClick={() => navigate(`/documents/${doc.id}`)}
                disabled={doc.status !== 'ready'}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-primary/90 bg-primary h-8 px-4 text-primary-foreground disabled:opacity-50"
              >
                打开
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
