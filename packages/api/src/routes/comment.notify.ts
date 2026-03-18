import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { createNotification } from '../utils/notifications.js';

interface CommentNotificationData {
  reply: any;
  rootRow: any;
  userId: string;
  content: string;
  replyToUserId?: string;
  inheritedBlockHash: string;
}

interface LikeNotificationData {
  userId: string;
  authorId: string;
  content: string | undefined;
  commentId: string;
  blockHash: string;
}

export async function sendCommentNotifications(data: CommentNotificationData): Promise<void> {
  const { reply, rootRow, userId, content, replyToUserId, inheritedBlockHash } = data;

  try {
    const notifDocRow = await pool.query(
      `SELECT d.id, d.title FROM documents d
       JOIN document_blocks db ON db.document_id = d.id
       WHERE db.block_hash = $1 AND d.canonical_document_id IS NULL LIMIT 1`,
      [inheritedBlockHash]
    );
    const nd = notifDocRow.rows[0];
    const senderName: string = reply.username || '有人';
    const notifData = {
      commentId: reply.id,
      documentId: nd?.id,
      documentTitle: nd?.title,
      blockHash: inheritedBlockHash,
      originalContent: (rootRow.content as string | undefined)?.slice(0, 150),
      selectedText: (rootRow.selected_text as string | undefined)?.slice(0, 200) || undefined,
    };

    const rootAuthorId: string | null = rootRow.user_id ?? null;
    if (rootAuthorId && rootAuthorId !== userId) {
      await createNotification({
        userId: rootAuthorId,
        type: 'reply',
        title: `${senderName} 回复了你的评论`,
        content: content.slice(0, 100),
        data: notifData,
      });
    }

    if (replyToUserId && replyToUserId !== userId && replyToUserId !== rootAuthorId) {
      await createNotification({
        userId: replyToUserId,
        type: 'mention',
        title: `${senderName} 在评论中提到了你`,
        content: content.slice(0, 100),
        data: notifData,
      });
    }
  } catch (err) {
    logger.warn('Comment notification failed:', err);
  }
}

export async function sendLikeNotification(data: LikeNotificationData): Promise<void> {
  const { userId, authorId, content, commentId, blockHash } = data;

  try {
    const senderRow = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    const senderName = senderRow.rows[0]?.username || '有人';
    const nd = await pool.query(
      `SELECT d.id, d.title FROM documents d
       JOIN document_blocks db ON db.document_id = d.id
       WHERE db.block_hash = $1 AND d.canonical_document_id IS NULL LIMIT 1`
    ).then(r => r.rows[0]);

    await createNotification({
      userId: authorId,
      type: 'like',
      title: `${senderName} 点赞了你的评论`,
      content: content?.slice(0, 100),
      data: {
        commentId,
        documentId: nd?.id,
        documentTitle: nd?.title,
        blockHash: Array.isArray(blockHash) ? blockHash[0] : blockHash,
        originalContent: content?.slice(0, 150),
      },
    });
  } catch (err) {
    logger.warn('Like notification failed:', err);
  }
}