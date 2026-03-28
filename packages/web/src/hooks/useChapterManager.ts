import { useState, useRef, useEffect } from 'react';
import type { Chapter } from '../components/TableOfContents';

export function useChapterManager(id: string | undefined, chapters: Chapter[], pendingScrollRef: React.MutableRefObject<number | null>) {
  const [currentChapter, setCurrentChapter] = useState(0);
  const savedChapterRef = useRef(0);
  const restoredRef = useRef(false);

  // 文档切换时读取上次阅读位置
  useEffect(() => {
    if (!id) return;
    setCurrentChapter(0);
    restoredRef.current = false;
    try {
      const saved = localStorage.getItem(`doc-chapter-${id}`);
      savedChapterRef.current = saved ? parseInt(saved, 10) : 0;
    } catch {
      savedChapterRef.current = 0;
    }
  }, [id]);

  // 章节列表首次建立（或文档切换后重建）时，恢复上次阅读位置
  useEffect(() => {
    if (chapters.length === 0) { restoredRef.current = false; return; }
    if (restoredRef.current) return;
    restoredRef.current = true;
    const target = Math.max(0, Math.min(chapters.length - 1, savedChapterRef.current));
    if (target > 0) setCurrentChapter(target);
    // 读取上次滚动位置，等内容渲染后恢复
    try {
      const savedY = localStorage.getItem(`doc-scroll-${id}`);
      const y = savedY ? parseInt(savedY, 10) : 0;
      if (target > 0) {
        // chapter 会变化，由 useEffect([currentChapter]) 负责滚动
        pendingScrollRef.current = y;
      } else {
        // chapter 不变（已是 0），直接用 rAF 恢复
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
      }
    } catch {}
  }, [chapters.length, id, pendingScrollRef]);

  // 章节内容切换后恢复滚动位置（刷新时）或回顶（手动翻章节时）
  useEffect(() => {
    if (pendingScrollRef.current === null) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    // 双 rAF 确保 DOM 已完整渲染再滚动
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
  }, [currentChapter, pendingScrollRef]);

  const goToChapter = (idx: number, callbacks?: { onGoTo?: () => void }) => {
    const target = Math.max(0, Math.min(chapters.length - 1, idx));
    setCurrentChapter(target);
    // 翻章节时清零滚动记录，确保到新章节顶部
    try { if (id) localStorage.removeItem(`doc-scroll-${id}`); } catch {}
    pendingScrollRef.current = 0; // 让 useEffect 滚到顶
    try { if (id) localStorage.setItem(`doc-chapter-${id}`, String(target)); } catch {}
    
    if (callbacks?.onGoTo) {
      callbacks.onGoTo();
    }
  };

  return { currentChapter, setCurrentChapter, goToChapter };
}
