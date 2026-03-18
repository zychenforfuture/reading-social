/**
 * DocumentPage 组件测试 - 核心功能验证
 * 验证文档阅读页面的基本渲染
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock all required modules at the top level
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'test-doc-id' }),
  useSearchParams: () => [
    new URLSearchParams(),
    vi.fn(),
  ],
}));

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

vi.mock('../lib/utils', () => ({
  api: {
    getDocument: vi.fn().mockResolvedValue({
      document: { id: 'test-id', title: '测试文档' },
      content: [],
      pagination: { offset: 0, limit: 5000, total: 0, hasMore: false },
    }),
    getBlockComments: vi.fn().mockResolvedValue({ comments: [], blockCommentCount: {} }),
    createComment: vi.fn(),
    likeComment: vi.fn(),
  },
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock components
vi.mock('../components/CommentPanel', () => ({ default: () => <div data-testid="mock-comment-panel">CommentPanel</div> }));
vi.mock('../components/TableOfContents', () => ({ default: () => <div data-testid="mock-toc">TOC</div> }));
vi.mock('../components/document/ReadingSettings', () => ({ 
  default: () => <div data-testid="mock-settings">Settings</div>,
  loadSettings: vi.fn(() => ({ fontSize: 16, lineHeight: 1.5, bgKey: 'light' })),
  BG_THEMES: [
    { key: 'light', label: '浅色', bgColor: '#ffffff', textColor: '#000000' },
    { key: 'dark', label: '暗色', bgColor: '#1a1a1a', textColor: '#ffffff' },
  ],
}));
vi.mock('../components/document/DocumentHeader', () => ({ default: () => <div data-testid="mock-header">DocumentHeader</div> }));
vi.mock('../components/document/DocumentContent', () => ({ default: () => <div data-testid="mock-content">DocumentContent</div> }));
vi.mock('../components/document/DocumentFooter', () => ({ default: () => <div data-testid="mock-footer">DocumentFooter</div> }));
vi.mock('../utils/chapterUtils', () => ({
  buildChapters: vi.fn(() => []),
}));

describe('DocumentPage - 核心功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该加载并渲染文档组件结构', async () => {
    render(<DocumentPage />);
    
    // 组件会先显示加载状态，然后渲染内容
    // 等待_useQuery_的_initialData_解析
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 检查是否渲染了核心组件
    expect(document.body.innerHTML).toContain('DocumentHeader');
    expect(document.body.innerHTML).toContain('DocumentContent');
    expect(document.body.innerHTML).toContain('DocumentFooter');
    expect(document.body.innerHTML).toContain('CommentPanel');
    expect(document.body.innerHTML).toContain('TOC');
  });

  it('应该调用API获取文档内容', async () => {
    render(<DocumentPage />);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(require('../lib/utils').api.getDocument).toHaveBeenCalledWith('test-doc-id', 0, 5000);
  });

  it('应该渲染APP标题', () => {
    render(<DocumentPage />);
    
    // 检查文档标题或APP名称
    expect(document.body.innerHTML).toContain('共鸣阅读');
  });

  it('应该初始化阅读设置', () => {
    render(<DocumentPage />);
    
    expect(require('../components/document/ReadingSettings').loadSettings).toHaveBeenCalled();
  });
});

// Import the component after all mocks are set up
import DocumentPage from './DocumentPage';
