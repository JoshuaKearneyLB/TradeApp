import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket/index.js';
import { NotificationType } from '@tradeapp/shared';
import { sendNewMessageEmail } from '../services/email.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { jobId } = req.params;

    if (!UUID_RE.test(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    // Verify requester is a participant
    const jobResult = await query(
      'SELECT customer_id, professional_id FROM jobs WHERE id = $1',
      [jobId],
    );
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const job = jobResult.rows[0];
    if (job.customer_id !== userId && job.professional_id !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const result = await query(
      `SELECT m.id, m.job_id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
              u.first_name, u.last_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.job_id = $1
       ORDER BY m.created_at ASC`,
      [jobId],
    );

    // Mark messages sent to this user as read
    await query(
      'UPDATE messages SET is_read = true WHERE job_id = $1 AND receiver_id = $2 AND is_read = false',
      [jobId, userId],
    );

    res.json({
      messages: result.rows.map((r: any) => ({
        id: r.id,
        jobId: r.job_id,
        senderId: r.sender_id,
        receiverId: r.receiver_id,
        senderName: `${r.first_name} ${r.last_name}`,
        content: r.content,
        isRead: r.is_read,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { jobId } = req.params;
    const { receiverId, content } = req.body;

    if (!UUID_RE.test(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    // Verify sender is a participant and receiver is the other party
    const jobResult = await query(
      `SELECT j.customer_id, j.professional_id, j.title, j.status,
              u.first_name, u.last_name,
              ru.email AS receiver_email, ru.first_name AS receiver_first_name
       FROM jobs j
       JOIN users u ON u.id = $2
       JOIN users ru ON ru.id = $3
       WHERE j.id = $1`,
      [jobId, userId, receiverId],
    );

    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = jobResult.rows[0];
    const isParticipant =
      (job.customer_id === userId && job.professional_id === receiverId) ||
      (job.professional_id === userId && job.customer_id === receiverId);

    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!['accepted', 'in_progress', 'completed'].includes(job.status)) {
      res.status(400).json({ error: 'Cannot send messages on this job' });
      return;
    }

    // Insert message
    const msgResult = await query(
      `INSERT INTO messages (job_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [jobId, userId, receiverId, content],
    );

    const msg = msgResult.rows[0];
    const senderName = `${job.first_name} ${job.last_name}`;

    const messageData = {
      messageId: msg.id,
      jobId,
      senderId: userId,
      senderName,
      content,
      timestamp: msg.created_at.toISOString(),
    };

    // Emit to job room (both parties)
    getIO().to(`job:${jobId}`).emit('new_message', messageData);

    // Notify receiver via notification system
    const notifResult = await query(
      `INSERT INTO notifications (user_id, type, title, content, related_job_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [receiverId, NotificationType.MESSAGE, `New message from ${senderName}`, content.slice(0, 100), jobId],
    );
    const notif = notifResult.rows[0];
    getIO().to(`user:${receiverId}`).emit('new_notification', {
      notificationId: notif.id,
      type: NotificationType.MESSAGE,
      title: `New message from ${senderName}`,
      content: content.slice(0, 100),
      relatedJobId: jobId,
      createdAt: notif.created_at.toISOString(),
    });

    // Email notification (throttled inside email service)
    sendNewMessageEmail(
      receiverId,
      jobId,
      job.receiver_email,
      job.receiver_first_name,
      senderName,
      job.title,
      content.slice(0, 120),
    );

    res.status(201).json(messageData);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
