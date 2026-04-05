import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { UserRole } from '@tradeapp/shared';
import { validate } from '../middleware/validate.js';
import { confirmPaymentSchema } from '../schemas/payments.schemas.js';
import {
  onboardProfessional,
  getOnboardingStatus,
  createPaymentIntent,
  confirmPayment,
  getJobPayment,
} from '../controllers/payments.controller.js';

const router = Router();

router.post('/onboard', authenticateToken, requireRole(UserRole.PROFESSIONAL), onboardProfessional);
router.get('/onboard/status', authenticateToken, requireRole(UserRole.PROFESSIONAL), getOnboardingStatus);
router.post('/jobs/:id/intent', authenticateToken, requireRole(UserRole.CUSTOMER), createPaymentIntent);
router.post('/jobs/:id/confirm', authenticateToken, requireRole(UserRole.CUSTOMER), validate(confirmPaymentSchema), confirmPayment);
router.get('/jobs/:id', authenticateToken, getJobPayment);

export default router;
