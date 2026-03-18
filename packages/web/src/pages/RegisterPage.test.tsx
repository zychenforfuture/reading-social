/**
 * RegisterPage 组件测试
 * 验证注册页面的基本渲染和功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock all dependencies before importing the component
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
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

describe('RegisterPage - 基本渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该渲染注册表单的基本元素', () => {
    render(<RegisterPage />);
    
    const usernameInput = screen.getByPlaceholderText('用户名');
    const emailInput = screen.getByPlaceholderText('邮箱');
    const codeInput = screen.getByPlaceholderText('邮箱验证码');
    const passwordInput = screen.getByPlaceholderText('密码');
    const confirmInput = screen.getByPlaceholderText('再次输入密码');
    
    expect(usernameInput).toBeTruthy();
    expect(emailInput).toBeTruthy();
    expect(codeInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(confirmInput).toBeTruthy();
  });

  it('应该渲染返回登录链接', () => {
    render(<RegisterPage />);
    
    expect(screen.getByText('返回登入')).toBeTruthy();
  });

  it('应该渲染验证码发送按钮', () => {
    render(<RegisterPage />);
    
    expect(screen.getByRole('button', { name: '发送' })).toBeTruthy();
  });

  it('应该显示APP标题', () => {
    render(<RegisterPage />);
    
    const titles = screen.getAllByText('共鸣阅读');
    expect(titles.length).toBeGreaterThan(0);
  });

  it('表单字段应该是必填的', () => {
    render(<RegisterPage />);
    
    const usernameInput = screen.getByPlaceholderText('用户名') as HTMLInputElement;
    const emailInput = screen.getByPlaceholderText('邮箱') as HTMLInputElement;
    const codeInput = screen.getByPlaceholderText('邮箱验证码') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('密码') as HTMLInputElement;
    const confirmInput = screen.getByPlaceholderText('再次输入密码') as HTMLInputElement;
    
    expect(usernameInput.required).toBe(true);
    expect(emailInput.required).toBe(true);
    expect(codeInput.required).toBe(true);
    expect(passwordInput.required).toBe(true);
    expect(confirmInput.required).toBe(true);
  });

  it('验证码发送按钮在未输入邮箱时应该被禁用', () => {
    render(<RegisterPage />);
    
    const sendCodeButton = screen.getByRole('button', { name: '发送' });
    // 检查按钮的 disabled 属性
    expect(sendCodeButton).toBeDefined();
    expect((sendCodeButton as HTMLButtonElement).disabled).toBe(true);
  });
});

// Import the component after all mocks are set up
import RegisterPage from './RegisterPage';
