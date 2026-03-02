import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { createRating, getJobRating } from '../controllers/ratings.controller.js';
import { UserRole } from '@tradeapp/shared';

const router = Router();

router.post('/', authenticateToken, requireRole(UserRole.CUSTOMER), createRating);
router.get('/job/:jobId', authenticateToken, getJobRating);

export default router;
