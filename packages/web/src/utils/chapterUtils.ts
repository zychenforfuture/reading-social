import { ContentBlock } from '../lib/utils';

export interface Chapter {
  index: number;
  title: string;
  blockStart: number;
  blockCount: number;
  commentCount: number;
}

/** 从 blocks 中提取章节结构 */
export function buildChapters(blocks: ContentBlock[], blockCommentCount: Record<string, number>): Chapter[] {
  if (blocks.length === 0) return [];

  // 找到所有章节标题块的索引
  const headingIndexes: number[] = [];
  blocks.forEach((b, i) => {
    // 兼容旧数据或无 type 字段情况，如果有 type 字段则优先使用
    if (b.type === 'heading') {
      headingIndexes.push(i);
    } else if (!b.type) {
      // 兼容回退逻辑，如果全量数据未包含 type，仍做基本正则判断（或直接忽略，这里保留简单正则以防万一）
      const firstLine = b.raw_content.split('\n')[0]?.trim() ?? '';
      if (/^(第\s*[零一二三四五六七八九十百千\d]+\s*[章节卷回篇]|Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|卷[零一二三四五六七八九十百千\d]+)/i.test(firstLine)) {
        headingIndexes.push(i);
      }
    }
  });

  // 如果检测到至少 1 个章节标题，按标题切分
  if (headingIndexes.length >= 1) {
    const chapters: Chapter[] = [];

    // 第一章标题前若有内容，单独作为"前言"章节
    if (headingIndexes[0] > 0) {
      const preBlocks = blocks.slice(0, headingIndexes[0]);
      const commentCount = preBlocks.reduce((s, b) => s + (blockCommentCount[b.block_hash] || 0), 0);
      chapters.push({ index: 0, title: '前言', blockStart: 0, blockCount: headingIndexes[0], commentCount });
    }

    headingIndexes.forEach((start, idx) => {
      const end = headingIndexes[idx + 1] ?? blocks.length;
      const title = blocks[start]!.raw_content.split('\n')[0]!.trim();
      const chBlocks = blocks.slice(start, end);
      const commentCount = chBlocks.reduce((s, b) => s + (blockCommentCount[b.block_hash] || 0), 0);
      chapters.push({ index: chapters.length, title, blockStart: start, blockCount: end - start, commentCount });
    });

    return chapters.map((c, i) => ({ ...c, index: i }));
  }

  // 否则按每 20 块自动分章
  const BLOCKS_PER_CHAPTER = 20;
  const chapters: Chapter[] = [];
  let i = 0;
  while (i < blocks.length) {
    const start = i;
    const end = Math.min(i + BLOCKS_PER_CHAPTER, blocks.length);
    const chBlocks = blocks.slice(start, end);
    const commentCount = chBlocks.reduce((s, b) => s + (blockCommentCount[b.block_hash] || 0), 0);
    chapters.push({
      index: chapters.length,
      title: `第 ${chapters.length + 1} 章（第 ${start + 1}–${end} 段）`,
      blockStart: start,
      blockCount: end - start,
      commentCount,
    });
    i = end;
  }
  return chapters;
}