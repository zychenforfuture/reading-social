/**
 * 示例测试文件
 * 验证 Vitest + Testing Library 配置是否正确
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// 示例组件：Button
const Button = ({ 
  children, 
  onClick, 
  disabled = false,
  className = '' 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  disabled?: boolean;
  className?: string;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

describe('Button 组件', () => {
  it('应该渲染子元素', () => {
    render(<Button>点击我</Button>);
    
    const button = screen.getByRole('button', { name: '点击我' });
    expect(button).toBeTruthy();
  });

  it('应该触发 onClick 回调', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>测试按钮</Button>);
    
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '测试按钮' }));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 为 true 时应该不可点击', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>禁用按钮</Button>);
    
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '禁用按钮' }));
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('应该支持自定义 className', () => {
    render(<Button className="custom-button">自定义样式</Button>);
    
    const button = screen.getByRole('button', { name: '自定义样式' });
    expect(button.className).toContain('custom-button');
  });
});

describe('Button - 边界情况', () => {
  it('应该正确处理异步操作', async () => {
    const handleClick = vi.fn();
    
    render(
      <Button 
        onClick={async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          handleClick();
        }}
      >
        异步按钮
      </Button>
    );
    
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '异步按钮' }));
    
    // 等待异步操作完成
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
