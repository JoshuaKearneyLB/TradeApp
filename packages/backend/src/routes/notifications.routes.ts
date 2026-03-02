import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getNotifications, markRead, markAllRead } from '../controllers/notifications.controller.js';

const router = Router();

router.get('/', authenticateToken, getNotifications);
router.patch('/read-all', authenticateToken, markAllRead);
router.patch('/:id/read', authenticateToken, markRead);

export default router;
