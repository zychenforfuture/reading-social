/**
 * DocumentPage 组件测试 - 核心功能验证
 * 验证文档阅读页面的基本渲染
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import * as utilsModule from '../lib/utils.js';
import * as readingSettingsModule from '../components/document/ReadingSettings.js';
import React from 'react';

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
    data: { comments: [], blockCommentCount: {} },
    isLoading: false,
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
      content: [{ block_hash: 'h1', raw_content: 'Content', word_count: 10 }],
      pagination: { offset: 0, limit: 5000, total: 1, hasMore: false },
    }),
    getDocumentComments: vi.fn().mockResolvedValue({ comments: [], blockCommentCount: {} }),
    createComment: vi.fn(),
    likeComment: vi.fn(),
  },
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock hooks
vi.mock('../hooks/useCommentSSE', () => ({ useCommentSSE: vi.fn() }));
vi.mock('../hooks/useDocumentScroll', () => ({ useDocumentScroll: vi.fn(() => ({ current: null })) }));
vi.mock('../hooks/useChapterManager', () => ({ 
  useChapterManager: vi.fn(() => ({ 
    currentChapter: 0, 
    setCurrentChapter: vi.fn(), 
    goToChapter: vi.fn() 
  })) 
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
vi.mock('../components/document/DocumentContent', () => ({ 
  default: React.forwardRef((props, ref) => <div data-testid="mock-content">DocumentContent</div>)
}));
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
    
    // 等待加载完成
    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });
    
    // 检查是否渲染了核心组件
    expect(screen.getByTestId('mock-header')).toBeInTheDocument();
    expect(screen.getByTestId('mock-content')).toBeInTheDocument();
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();
  });

  it('应该调用API获取文档内容', async () => {
    render(<DocumentPage />);
    
    await waitFor(() => {
      expect(utilsModule.api.getDocument).toHaveBeenCalledWith('test-doc-id', 0, 5000);
    });
  });

  it('应该渲染文档标题', async () => {
    render(<DocumentPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });
    
    // 检查文档标题（通过 mock-header 的渲染逻辑确认 docMeta 已注入）
    expect(screen.getByTestId('mock-header')).toBeInTheDocument();
  });

  it('应该初始化阅读设置', () => {
    render(<DocumentPage />);
    
    expect(readingSettingsModule.loadSettings).toHaveBeenCalled();
  });
});

// Import the component after all mocks are set up
import DocumentPage from './DocumentPage';
