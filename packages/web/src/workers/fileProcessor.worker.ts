// Web Worker: 后台读取/解析文件，避免主线程阻塞

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

const CHUNK_SIZE = 512 * 1024; // TXT 每次读取 512KB，避免浏览器限制

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'PROCESS_FILE') {
    const { file } = e.data as { file: File };
    processFile(file).catch((err: Error) => {
      self.postMessage({ type: 'ERROR', message: err.message || '文件读取失败，请重试' });
    });
  }
};

async function processFile(file: File): Promise<void> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
    const { content, title } = await extractPdf(file);
    self.postMessage({ type: 'DONE', content, title });
    return;
  }

  // 默认按文本处理
  await readTextFileInChunks(file);
}

async function extractPdf(file: File): Promise<{ content: string; title: string }> {
  // 关闭 pdf.js 内部 worker，直接在当前 worker 解析，避免额外打包 worker 资源
  GlobalWorkerOptions.workerSrc = '';
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({
    data: arrayBuffer,
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  });

  const pdf = await loadingTask.promise;
  const texts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? (item as { str: string }).str : (item as any).unicode || ''))
      .join(' ');
    if (pageText.trim()) texts.push(pageText.trim());

    const progress = Math.min(95, Math.round((pageNum / pdf.numPages) * 100));
    self.postMessage({ type: 'PROGRESS', progress });
  }

  const title = file.name.replace(/\.pdf$/i, '');
  return { content: texts.join('\n\n'), title };
}

async function readTextFileInChunks(file: File): Promise<void> {
  const parts: string[] = [];
  let offset = 0;
  let errorOccurred = false;

  const readNextChunk = () => {
    if (errorOccurred || offset >= file.size) {
      if (!errorOccurred) {
        self.postMessage({ type: 'DONE', content: parts.join(''), title: file.name.replace(/\.txt$/i, '') });
      }
      return;
    }

    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const reader = new FileReader();

    reader.onload = (event) => {
      if (errorOccurred) return;

      const text = event.target?.result as string;
      parts.push(text);
      offset += chunk.size;

      const progress = Math.min(95, Math.round((offset / file.size) * 100));
      self.postMessage({ type: 'PROGRESS', progress });

      // 继续读取下一块
      setTimeout(readNextChunk, 0);
    };

    reader.onerror = () => {
      errorOccurred = true;
      self.postMessage({ type: 'ERROR', message: '文件读取失败，请重试' });
    };

    reader.readAsText(chunk);
  };

  readNextChunk();
}
