import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

// ─── 阅读设置 ───────────────────────────────────────────────
export const BG_THEMES: { key: string; label: string; bgColor: string; textColor: string }[] = [
  { key: 'white',     label: '默认',   bgColor: '#ffffff', textColor: '#1a1a1a' },
  { key: 'parchment', label: '羊皮纸', bgColor: '#f4ecd8', textColor: '#5a3e28' },
  { key: 'eye',       label: '护眼',   bgColor: '#cce8c4', textColor: '#293d29' },
  { key: 'dark',      label: '深色',   bgColor: '#1c1c1e', textColor: '#a8a8a8' },
];
const FONT_SIZES = [15, 16, 17, 18, 19, 20];
const LINE_HEIGHTS = [1.6, 1.8, 2.0, 2.2];

const SETTINGS_KEY = 'reading-settings';
export function loadSettings(): { fontSize: number; lineHeight: number; bgKey: string } {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    return {
      fontSize: FONT_SIZES.includes(s.fontSize) ? s.fontSize : 17,
      lineHeight: LINE_HEIGHTS.includes(s.lineHeight) ? s.lineHeight : 2.0,
      bgKey: BG_THEMES.find(t => t.key === s.bgKey) ? s.bgKey : 'white',
    };
  } catch { return { fontSize: 17, lineHeight: 2.0, bgKey: 'white' }; }
}
export function saveSettings(s: { fontSize: number; lineHeight: number; bgKey: string }) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

interface ReadingSettingsProps {
  fontSize: number;
  setFontSize: (size: number) => void;
  lineHeight: number;
  setLineHeight: (height: number) => void;
  bgKey: string;
  setBgKey: (key: string) => void;
  showSettings: boolean;
}

export default function ReadingSettings({
  fontSize,
  setFontSize,
  lineHeight,
  setLineHeight,
  bgKey,
  setBgKey,
  showSettings,
}: ReadingSettingsProps) {
  if (!showSettings) return null;

  return (
    <div className={cn(
      'rounded-xl border bg-background shadow-md px-5 py-4 space-y-4 text-sm'
    )}>
      {/* 字体大小 */}
      <div className="flex items-center gap-3">
        <span className="w-14 text-muted-foreground shrink-0">字体大小</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const i = FONT_SIZES.indexOf(fontSize); if (i > 0) { const v = FONT_SIZES[i-1]!; setFontSize(v); saveSettings({ fontSize: v, lineHeight, bgKey }); } }}
            disabled={fontSize === FONT_SIZES[0]}
            className="w-7 h-7 rounded border flex items-center justify-center text-base hover:bg-muted disabled:opacity-30"
          >－</button>
          <span className="w-10 text-center font-medium">{fontSize}px</span>
          <button
            onClick={() => { const i = FONT_SIZES.indexOf(fontSize); if (i < FONT_SIZES.length - 1) { const v = FONT_SIZES[i+1]!; setFontSize(v); saveSettings({ fontSize: v, lineHeight, bgKey }); } }}
            disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
            className="w-7 h-7 rounded border flex items-center justify-center text-base hover:bg-muted disabled:opacity-30"
          >＋</button>
        </div>
      </div>
      {/* 行距 */}
      <div className="flex items-center gap-3">
        <span className="w-14 text-muted-foreground shrink-0">行距</span>
        <div className="flex gap-2">
          {LINE_HEIGHTS.map(lh => (
            <button
              key={lh}
              onClick={() => { setLineHeight(lh); saveSettings({ fontSize, lineHeight: lh, bgKey }); }}
              className={cn('px-3 py-1 rounded border text-xs transition-colors', lh === lineHeight ? 'bg-orange-500 text-white border-orange-500' : 'hover:bg-muted')}
            >{lh.toFixed(1)}</button>
          ))}
        </div>
      </div>
      {/* 背景色 */}
      <div className="flex items-center gap-3">
        <span className="w-14 text-muted-foreground shrink-0">背景</span>
        <div className="flex gap-2">
          {BG_THEMES.map(t => (
            <button
              key={t.key}
              onClick={() => { setBgKey(t.key); saveSettings({ fontSize, lineHeight, bgKey: t.key }); }}
              className={cn('px-3 py-1 rounded border text-xs transition-all', t.key === bgKey ? 'ring-2 ring-orange-500 ring-offset-1' : 'hover:opacity-80')}
              style={{ backgroundColor: t.bgColor, color: t.textColor, borderColor: t.key === bgKey ? '#f97316' : '#e5e7eb' }}
            >{t.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}