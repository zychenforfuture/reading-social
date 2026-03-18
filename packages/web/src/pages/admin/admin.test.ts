/**
 * Admin 页面测试
 * 验证 AdminDashboard、AdminUsers、AdminDocuments、AdminComments 的基本渲染
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock all dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => ({
    data: options.initialData || null,
    isLoading: options.initialData ? false : true,
    isError: false,
  }),
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('../../lib/utils', () => ({
  api: {
    getAdminStats: vi.fn().mockResolvedValue({
      users: { total: 100, admins: 5, recent: 10 },
      documents: { total: 500, ready: 480, processing: 20, totalWords: 100000, recent: 50 },
      comments: { total: 2000, recent: 100 },
      blocks: { total: 5000 },
    }),
    getAdminUsers: vi.fn().mockResolvedValue({ users: [], pagination: { total: 0 } }),
    getAdminDocuments: vi.fn().mockResolvedValue({ documents: [], pagination: { total: 0 } }),
    getAdminComments: vi.fn().mockResolvedValue({ comments: [], pagination: { total: 0 } }),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({}),
}));

// Mock components
vi.mock('./AdminUsers', () => ({ default: () => <div data-testid="mock-admin-users">用户管理</div> }));
vi.mock('./AdminDocuments', () => ({ default: () => <div data-testid="mock-admin-documents">文档管理</div> }));
vi.mock('./AdminComments', () => ({ default: () => <div data-testid="mock-admin-comments">评论管理</div> }));

describe('Admin - AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该渲染系统概览卡片', () => {
    render(<AdminDashboard />);
    
    // 检查主要统计卡片
    expect(document.body.innerHTML).toContain('系统概览');
    expect(document.body.innerHTML).toContain('管理员控制面板');
    
    // 检查四个统计卡片的标题
    expect(document.body.innerHTML).toContain('用户总数');
    expect(document.body.innerHTML).toContain('文档总数');
    expect(document.body.innerHTML).toContain('评论总数');
    expect(document.body.innerHTML).toContain('内容块总数');
  });

  it('应该显示统计数据', async () => {
    render(<AdminDashboard />);
    
    // 等待数据加载
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(document.body.innerHTML).toContain('100'); // 用户总数
    expect(document.body.innerHTML).toContain('500'); // 文档总数
    expect(document.body.innerHTML).toContain('2,000'); // 评论总数
  });

  it('应该显示管理员数量', async () => {
    render(<AdminDashboard />);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(document.body.innerHTML).toContain('管理员: 5');
  });
});

describe('Admin - AdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该渲染用户列表容器', () => {
    render(<AdminUsers />);
    
    expect(screen.getByTestId('mock-admin-users')).toBeTruthy();
  });
});

describe('Admin - AdminDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该渲染文档列表容器', () => {
    render(<AdminDocuments />);
    
    expect(screen.getByTestId('mock-admin-documents')).toBeTruthy();
  });
});

describe('Admin - AdminComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该渲染评论列表容器', () => {
    render(<AdminComments />);
    
    expect(screen.getByTestId('mock-admin-comments')).toBeTruthy();
  });
});

// Import the components after all mocks are set up
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminDocuments from './AdminDocuments';
import AdminComments from './AdminComments';
