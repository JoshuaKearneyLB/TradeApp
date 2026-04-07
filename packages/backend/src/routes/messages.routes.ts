import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendMessageSchema } from '../schemas/messages.schemas.js';
import { getMessages, sendMessage } from '../controllers/messages.controller.js';

const router = Router();

router.get('/jobs/:jobId', authenticateToken, getMessages);
router.post('/jobs/:jobId', authenticateToken, validate(sendMessageSchema), sendMessage);

export default router;
