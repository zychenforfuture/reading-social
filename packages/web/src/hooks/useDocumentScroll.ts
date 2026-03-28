import { useEffect, useRef } from 'react';

export function useDocumentScroll(id: string | undefined) {
  const pendingScrollRef = useRef<number | null>(null);

  // 滚动时实时保存位置（防抖 400ms）
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try { localStorage.setItem(`doc-scroll-${id}`, String(Math.round(window.scrollY))); } catch {}
      }, 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (timer) clearTimeout(timer); };
  }, [id]);

  return pendingScrollRef;
}
