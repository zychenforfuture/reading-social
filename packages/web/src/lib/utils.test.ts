/**
 * 工具函数单元测试
 * 测试 timeAgo、cn、likeCommentWithDebounce 等工具函数
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, timeAgo } from './utils';

describe('cn() - Tailwind 类名合并', () => {
  it('应该合并多个类名', () => {
    const result = cn('px-4', 'py-2', 'rounded');
    expect(result).toBe('px-4 py-2 rounded');
  });

  it('应该解决 Tailwind 冲突类（后者覆盖前者）', () => {
    const result = cn('p-4', 'p-8');
    expect(result).toBe('p-8');
  });

  it('应该支持条件类名', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn('base', isActive && 'active', isDisabled && 'disabled');
    expect(result).toBe('base active');
  });

  it('应该过滤 undefined 和 false', () => {
    const result = cn('base', undefined, false, null as unknown as string, 'extra');
    expect(result).toBe('base extra');
  });

  it('应该处理空输入', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('应该支持对象语法', () => {
    const result = cn({ 'text-red-500': true, 'text-blue-500': false });
    expect(result).toBe('text-red-500');
  });

  it('应该合并重复的 padding 类', () => {
    const result = cn('px-2 py-1', 'px-4');
    expect(result).toBe('py-1 px-4');
  });
});

describe('timeAgo() - 相对时间格式化', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 固定当前时间为 2026-03-17T12:00:00.000Z
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-17T12:00:00.000Z').getTime());
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('30 秒前应该显示"刚刚"', () => {
    const date = new Date('2026-03-17T11:59:30.000Z').toISOString();
    expect(timeAgo(date)).toBe('刚刚');
  });

  it('1 分钟前应该显示"1 分钟前"', () => {
    const date = new Date('2026-03-17T11:59:00.000Z').toISOString();
    expect(timeAgo(date)).toBe('1 分钟前');
  });

  it('45 分钟前应该显示"45 分钟前"', () => {
    const date = new Date('2026-03-17T11:15:00.000Z').toISOString();
    expect(timeAgo(date)).toBe('45 分钟前');
  });

  it('1 小时前应该显示"1 小时前"', () => {
    const date = new Date('2026-03-17T11:00:00.000Z').toISOString();
    expect(timeAgo(date)).toBe('1 小时前');
  });

  it('5 小时前应该显示"5 小时前"', () => {
    const date = new Date('2026-03-17T07:00:00.000Z').toISOString();
    expect(timeAgo(date)).toBe('5 小时前');
  });

  it('1 天前应该显示"1 天前"', () => {
    const date = new Date('2026-03-16T12:00:00.000Z').toISOString();
    expect(timeAgo(date)).toBe('1 天前');
  });

  it('29 天前应该显示"29 天前"', () => {
    const date = new Date('2026-02-16T12:00:00.000Z').toISOString();
    expect(timeAgo(date)).toBe('29 天前');
  });

  it('超过 30 天应该显示本地化日期', () => {
    const date = new Date('2026-01-01T12:00:00.000Z').toISOString();
    const result = timeAgo(date);
    // 应该是类似 "1月1日" 的格式
    expect(result).not.toBe('刚刚');
    expect(result).not.toContain('分钟前');
    expect(result).not.toContain('小时前');
    expect(result).not.toContain('天前');
  });

  it('刚刚（0 分钟差）应该显示"刚刚"', () => {
    const date = new Date('2026-03-17T12:00:00.000Z').toISOString();
    expect(timeAgo(date)).toBe('刚刚');
  });
});
