/**
 * 测试辅助函数
 * 提供常用的 Mock 和工具函数
 */

import { vi } from 'vitest';

// Mock React Router
export const mockNavigate = vi.fn();
export const mockUseNavigate = () => mockNavigate;

export const mockReactRouter = () => {
  vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
      ...actual,
      useNavigate: mockUseNavigate,
    };
  });
};

// Mock React Query
export const mockReactQuery = () => {
  vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');
    return {
      ...actual,
      useQuery: vi.fn().mockImplementation(({ queryKey }) => {
        return {
          data: null,
          isLoading: false,
          isError: false,
          error: null,
        };
      }),
      useMutation: vi.fn().mockImplementation(() => ({
        mutate: vi.fn(),
        isPending: false,
        error: null,
      })),
    };
  });
};

// Mock WebSocket
export const mockWebSocket = () => {
  const mockSocket = {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  };

  vi.mockGlobal('WebSocket', vi.fn().mockImplementation(() => mockSocket));
};

// Mock Intersection Observer
export const mockIntersectionObserver = () => {
  const mockObserver = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };

  vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => mockObserver));
};

// Mock Resize Observer
export const mockResizeObserver = () => {
  const mockObserver = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };

  vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation(() => mockObserver));
};

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  });
};

// Utility: 创建测试用户
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'Test User',
  avatar_url: null,
  is_admin: false,
  ...overrides,
});

// Utility: 创建测试 token
export const createTestToken = (overrides = {}) => {
  const payload = {
    userId: 'test-user-id',
    email: 'test@example.com',
    isAdmin: false,
    ...overrides,
  };
  
  return btoa(JSON.stringify(payload));
};
