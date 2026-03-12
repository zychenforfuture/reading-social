// Web Worker: 后台分块读取文件，避免主线程阻塞

const CHUNK_SIZE = 512 * 1024; // 每次读取 512KB，避免浏览器限制

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'PROCESS_FILE') {
    const { file } = e.data as { file: File };
    readFileInChunks(file);
  }
};

function readFileInChunks(file: File): void {
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
