import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';

export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await query(
      `SELECT id, user_id, type, title, content, related_job_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    res.json({
      notifications: result.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        title: r.title,
        content: r.content,
        relatedJobId: r.related_job_id,
        isRead: r.is_read,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markAllRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
