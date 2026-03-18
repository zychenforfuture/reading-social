import { Response } from 'express';
import { logger } from '../config/logger.js';

// SSE 客户端注册表
const sseClients = new Map<string, Set<Response>>();
const sseHeartbeats = new WeakMap<Response, NodeJS.Timeout>();
const sseConnectionTime = new WeakMap<Response, number>();
const sseLastHeartbeat = new WeakMap<Response, number>();

const MAX_CONNECTIONS_PER_DOCUMENT = 100;
const MAX_CONNECTION_AGE_MS = 30 * 60 * 1000;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export function addSseClient(documentId: string, res: Response): boolean {
  if (!sseClients.has(documentId)) sseClients.set(documentId, new Set());
  const clients = sseClients.get(documentId)!;

  if (clients.size >= MAX_CONNECTIONS_PER_DOCUMENT) {
    return false;
  }

  clients.add(res);
  sseConnectionTime.set(res, Date.now());
  sseLastHeartbeat.set(res, Date.now());
  return true;
}

export function removeSseClient(documentId: string, res: Response): void {
  const clients = sseClients.get(documentId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) sseClients.delete(documentId);
  }
}

export function broadcastToDocument(documentId: string | string[], data: object): void {
  const docIds = Array.isArray(documentId) ? documentId : [documentId];
  for (const docId of docIds) {
    const clients = sseClients.get(docId);
    if (!clients || clients.size === 0) continue;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try { res.write(payload); } catch {
        // 客户端已断开，静默忽略
      }
    }
  }
}

function cleanupTimeout(): void {
  let cleanedCount = 0;
  const now = Date.now();

  for (const [documentId, clients] of sseClients.entries()) {
    const toRemove: Response[] = [];
    for (const res of clients) {
      if (res.writableEnded) {
        toRemove.push(res);
        continue;
      }

      const connectTime = sseConnectionTime.get(res);
      if (connectTime && now - connectTime > MAX_CONNECTION_AGE_MS) {
        toRemove.push(res);
        logger.info(`SSE forced disconnect: doc=${documentId.substring(0, 8)}… (max age exceeded)`);
        continue;
      }

      const lastHeartbeat = sseLastHeartbeat.get(res);
      if (lastHeartbeat && now - lastHeartbeat > IDLE_TIMEOUT_MS) {
        toRemove.push(res);
        logger.info(`SSE idle timeout: doc=${documentId.substring(0, 8)}…`);
        continue;
      }
    }

    for (const res of toRemove) {
      const heartbeat = sseHeartbeats.get(res);
      if (heartbeat) clearInterval(heartbeat);
      removeSseClient(documentId, res);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info(`SSE cleanup: removed ${cleanedCount} stale clients`);
  }
}

setInterval(() => cleanupTimeout(), 60 * 1000);
logger.info('SSE cleanup scheduled every 1 minute');