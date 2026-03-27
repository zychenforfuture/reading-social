import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from './logger.js';

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
export const qdrantClient = new QdrantClient({ url: qdrantUrl });

export const COLLECTION_NAME = 'content_embeddings';
export const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 输出 384 维向量

/**
 * 将 block_hash（64 位 SHA-256 hex）转换为 UUID 格式
 * Qdrant point ID 只接受无符号整数或 UUID，取前 32 位重新格式化
 */
function blockHashToUUID(blockHash: string): string {
  const h = blockHash.slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * 初始化 Qdrant 集合
 */
export async function initializeQdrant(): Promise<void> {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
        // 标量量化（int8）：存储从 float32 压缩到 int8
        // 4× 压缩比，精度损失 < 1%
        quantization_config: {
          scalar: {
            type: 'int8',
            quantile: 0.99,
            always_ram: true,
          },
        },
        optimizers_config: {
          default_segment_number: 2,
        },
      });

      // 创建 payload 索引
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'block_hash',
        field_schema: 'keyword',
        wait: true,
      });

      logger.info(`Qdrant collection "${COLLECTION_NAME}" created with int8 scalar quantization`);
    } else {
      // 对已有 collection 热更新量化配置（若尚未配置）
      try {
        await qdrantClient.updateCollection(COLLECTION_NAME, {
          quantization_config: {
            scalar: {
              type: 'int8',
              quantile: 0.99,
              always_ram: true,
            },
          },
        });
        logger.info(`Qdrant collection "${COLLECTION_NAME}" quantization updated to int8`);
      } catch {
        logger.info(`Qdrant collection "${COLLECTION_NAME}" already exists`);
      }
    }
  } catch (error) {
    logger.error('Failed to initialize Qdrant collection:', error);
    throw error;
  }
}

/**
 * 检查某个块的 embedding 是否已在 Qdrant 中存在
 */
export async function checkEmbeddingExists(blockHash: string): Promise<boolean> {
  try {
    const results = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: [blockHashToUUID(blockHash)],
    });
    return results.length > 0;
  } catch {
    return false;
  }
}

/**
 * 根据向量查找相似的块
 */
export async function findSimilarEmbeddings(
  embedding: number[],
  limit: number = 5,
  scoreThreshold: number = 0.78
): Promise<Array<{ block_hash: string; score: number }>> {
  try {
    const results = await qdrantClient.search(COLLECTION_NAME, {
      vector: embedding,
      limit: limit,
      score_threshold: scoreThreshold,
      with_payload: true,
    });

    return results.map(result => ({
      block_hash: (result.payload as any).block_hash,
      score: result.score
    }));
  } catch (error) {
    logger.error('Failed to search similar embeddings:', error);
    throw error;
  }
}
