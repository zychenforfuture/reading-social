import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';

export const qdrantClient = new QdrantClient({
  url: qdrantUrl,
});

const COLLECTION_NAME = 'content_embeddings';
const VECTOR_SIZE = 768; // 使用 sentence-transformers/paraphrase-multilingual-v2

export async function initializeQdrant(): Promise<void> {
  const collections = await qdrantClient.getCollections();

  const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

  if (!exists) {
    await qdrantClient.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
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

    await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'document_id',
      field_schema: 'keyword',
      wait: true,
    });

    console.log(`Qdrant collection "${COLLECTION_NAME}" created`);
  } else {
    console.log(`Qdrant collection "${COLLECTION_NAME}" already exists`);
  }
}

export { COLLECTION_NAME, VECTOR_SIZE };
