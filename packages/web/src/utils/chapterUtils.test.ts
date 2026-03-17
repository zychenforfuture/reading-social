/**
 * chapterUtils 单元测试
 * 测试章节提取函数 buildChapters()
 */

import { describe, it, expect } from 'vitest';
import { buildChapters } from './chapterUtils';
import type { ContentBlock } from '../lib/utils';

// 创建测试用的 ContentBlock
function makeBlock(hash: string, content: string): ContentBlock {
  return {
    block_hash: hash,
    raw_content: content,
    word_count: content.length,
  };
}

describe('buildChapters() - 章节提取', () => {
  describe('空输入', () => {
    it('空 blocks 数组应该返回空数组', () => {
      const result = buildChapters([], {});
      expect(result).toEqual([]);
    });
  });

  describe('中文章节标题检测', () => {
    it('应该检测"第X章"格式的章节', () => {
      const blocks = [
        makeBlock('b1', '第一章 序幕\n内容开始'),
        makeBlock('b2', '正文内容'),
        makeBlock('b3', '第二章 发展\n内容继续'),
        makeBlock('b4', '更多内容'),
      ];

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('第一章 序幕');
      expect(chapters[0].blockStart).toBe(0);
      expect(chapters[0].blockCount).toBe(2);
      expect(chapters[1].title).toBe('第二章 发展');
      expect(chapters[1].blockStart).toBe(2);
      expect(chapters[1].blockCount).toBe(2);
    });

    it('应该检测"第X节"格式', () => {
      const blocks = [
        makeBlock('b1', '第一节 介绍'),
        makeBlock('b2', '内容'),
        makeBlock('b3', '第二节 详情'),
      ];

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('第一节 介绍');
      expect(chapters[1].title).toBe('第二节 详情');
    });

    it('章节标题前的内容应该作为"前言"章节', () => {
      const blocks = [
        makeBlock('b0', '这是前言内容'),
        makeBlock('b1', '第一章 正文\n开始'),
        makeBlock('b2', '内容'),
      ];

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('前言');
      expect(chapters[0].blockStart).toBe(0);
      expect(chapters[0].blockCount).toBe(1);
      expect(chapters[1].title).toBe('第一章 正文');
    });
  });

  describe('英文章节标题检测', () => {
    it('应该检测"Chapter N"格式', () => {
      const blocks = [
        makeBlock('b1', 'Chapter 1\nIntroduction'),
        makeBlock('b2', 'Some content'),
        makeBlock('b3', 'Chapter 2\nDevelopment'),
      ];

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('Chapter 1');
      expect(chapters[1].title).toBe('Chapter 2');
    });

    it('应该检测"CHAPTER N"大写格式', () => {
      const blocks = [
        makeBlock('b1', 'CHAPTER 1\nIntroduction'),
        makeBlock('b2', 'CHAPTER 2\nBody'),
      ];

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('CHAPTER 1');
    });

    it('应该检测"Part N"格式', () => {
      const blocks = [
        makeBlock('b1', 'Part 1\nFirst Part'),
        makeBlock('b2', 'Content'),
        makeBlock('b3', 'Part 2\nSecond Part'),
      ];

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('Part 1');
    });
  });

  describe('自动分章（无章节标题）', () => {
    it('少于 20 块时应该只有 1 章', () => {
      const blocks = Array.from({ length: 10 }, (_, i) =>
        makeBlock(`b${i}`, `段落 ${i + 1} 的内容`)
      );

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('第 1 章（第 1–10 段）');
      expect(chapters[0].blockStart).toBe(0);
      expect(chapters[0].blockCount).toBe(10);
    });

    it('21 块应该分为 2 章', () => {
      const blocks = Array.from({ length: 21 }, (_, i) =>
        makeBlock(`b${i}`, `段落 ${i + 1} 的内容`)
      );

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(2);
      expect(chapters[0].blockCount).toBe(20);
      expect(chapters[1].blockCount).toBe(1);
      expect(chapters[1].title).toBe('第 2 章（第 21–21 段）');
    });

    it('恰好 20 块时应该只有 1 章', () => {
      const blocks = Array.from({ length: 20 }, (_, i) =>
        makeBlock(`b${i}`, `段落 ${i + 1}`)
      );

      const chapters = buildChapters(blocks, {});
      expect(chapters).toHaveLength(1);
    });
  });

  describe('章节评论数统计', () => {
    it('应该正确汇总章节内的评论数', () => {
      const blocks = [
        makeBlock('hash1', '第一章 开始'),
        makeBlock('hash2', '内容'),
        makeBlock('hash3', '第二章 继续'),
        makeBlock('hash4', '更多内容'),
      ];

      const blockCommentCount: Record<string, number> = {
        hash1: 3,
        hash2: 5,
        hash3: 1,
        hash4: 2,
      };

      const chapters = buildChapters(blocks, blockCommentCount);
      expect(chapters[0].commentCount).toBe(8); // 3 + 5
      expect(chapters[1].commentCount).toBe(3); // 1 + 2
    });

    it('没有评论时 commentCount 应该为 0', () => {
      const blocks = [
        makeBlock('h1', '第一章 无评论'),
        makeBlock('h2', '内容'),
      ];

      const chapters = buildChapters(blocks, {});
      expect(chapters[0].commentCount).toBe(0);
    });
  });

  describe('章节索引', () => {
    it('章节索引应该从 0 开始连续', () => {
      const blocks = [
        makeBlock('b1', '第一章 开始'),
        makeBlock('b2', '第二章 中间'),
        makeBlock('b3', '第三章 结束'),
      ];

      const chapters = buildChapters(blocks, {});
      chapters.forEach((c, i) => {
        expect(c.index).toBe(i);
      });
    });
  });
});
