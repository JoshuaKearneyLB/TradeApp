import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { createRating, getJobRating } from '../controllers/ratings.controller.js';
import { UserRole } from '@tradeapp/shared';
import { validate } from '../middleware/validate.js';
import { createRatingSchema } from '../schemas/ratings.schemas.js';

const router = Router();

router.post('/', authenticateToken, requireRole(UserRole.CUSTOMER), validate(createRatingSchema), createRating);
router.get('/job/:jobId', authenticateToken, getJobRating);

export default router;
