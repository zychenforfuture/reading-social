import { pipeline, env } from '@xenova/transformers';
import { logger } from './logger.js';

// 配置 transformers.js 使用本地缓存
env.allowLocalModels = true;
env.cacheDir = './.cache';

let embeddingPipeline: any = null;

/**
 * 获取嵌入模型管道（单例模式）
 */
export async function getEmbeddingPipeline() {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  try {
    logger.info('Loading embedding model...');
    // 使用轻量级的多语言嵌入模型
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    logger.info('Embedding model loaded successfully');
    return embeddingPipeline;
  } catch (error) {
    logger.error('Failed to load embedding model:', error);
    throw error;
  }
}

/**
 * 生成文本的向量嵌入
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}