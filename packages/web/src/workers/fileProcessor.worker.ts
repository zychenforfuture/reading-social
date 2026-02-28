// Web Worker: 后台分块读取文件，避免主线程阻塞

const CHUNK_SIZE = 1024 * 1024; // 每次读取 1MB

self.onmessage = async (e: MessageEvent) => {
  if (e.data.type === 'PROCESS_FILE') {
    const { file } = e.data as { file: File };
    try {
      const content = await readFileInChunks(file);
      self.postMessage({ type: 'DONE', content, title: file.name.replace(/\.txt$/i, '') });
    } catch (err) {
      self.postMessage({ type: 'ERROR', message: (err as Error).message });
    }
  }
};

async function readFileInChunks(file: File): Promise<string> {
  const parts: string[] = [];
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const text = await chunk.text();
    parts.push(text);
    offset += CHUNK_SIZE;

    const progress = Math.min(99, Math.round((offset / file.size) * 100));
    self.postMessage({ type: 'PROGRESS', progress });
  }

  return parts.join('');
}
