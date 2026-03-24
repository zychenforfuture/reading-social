import { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface CommentFormProps {
  selectedBlock: { hash: string; text: string } | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export default function CommentForm({
  selectedBlock,
  value,
  onChange,
  onSubmit,
  isPending,
}: CommentFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selectedBlock) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [selectedBlock]);

  return (
    <div className="border-t bg-white dark:bg-zinc-900 px-4 py-3 space-y-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!selectedBlock}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit();
          }}
          rows={2}
          placeholder={selectedBlock ? '写下你的评论… (⌘Enter 发送)' : '点击正文句子开始评论'}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim() || !selectedBlock || isPending}
          className="h-9 w-9 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30 hover:bg-primary/90 transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}