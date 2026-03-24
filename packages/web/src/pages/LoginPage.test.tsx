/**
 * LoginPage 组件测试
 * 验证登录页面的基本渲染和功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock all dependencies before importing the component
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: undefined }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    isSuccess: false,
    isError: false,
    isPending: false,
    error: null,
  }),
}));

describe('LoginPage - 基本渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该渲染登录表单的基本元素', () => {
    render(<LoginPage />);
    
    const emailInput = screen.getByPlaceholderText('邮箱');
    const passwordInput = screen.getByPlaceholderText('密码');
    const submitButton = screen.getByRole('button', { name: /↩ 登入/i });
    
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();
  });

  it('应该渲染注册和忘记密码链接', () => {
    render(<LoginPage />);
    
    expect(screen.getByText('注册')).toBeTruthy();
    expect(screen.getByText('忘记密码')).toBeTruthy();
  });

  it('应该显示APP标题', () => {
    render(<LoginPage />);
    
    const titles = screen.getAllByText('共鸣阅读');
    expect(titles.length).toBeGreaterThan(0);
  });
});

// Import the component after all mocks are set up
import LoginPage from './LoginPage';
