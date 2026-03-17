/**
 * Vitest 全局设置
 * 这个文件会在每个测试文件之前执行
 */

import { vi, expect } from 'vitest';

// 声明全局 vi（供测试文件使用，即使不导入也能使用）
declare global {
  const vi: typeof import('vitest');
}

// Mock 不支持的浏览器 API
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

if (typeof window.IntersectionObserver === 'undefined') {
  window.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

if (typeof window.WebSocket === 'undefined') {
  window.WebSocket = vi.fn().mockImplementation(() => ({
    readyState: 0,
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  }));
}

// Mock ES Module
vi.mock('y-websocket', () => ({
  WebrtcProvider: vi.fn(),
  WebsocketProvider: vi.fn(),
}));

vi.mock('yjs', () => ({
  Doc: vi.fn(),
  Text: vi.fn(),
  insert: vi.fn(),
  observe: vi.fn(),
}));
