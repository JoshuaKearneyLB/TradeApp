import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { UserRole } from '@tradeapp/shared';
import {
  getStats,
  getUsers,
  updateUserStatus,
  getAdminJobs,
  getAdminPayments,
} from '../controllers/admin.controller.js';

const router = express.Router();

router.get('/stats', authenticateToken, requireRole(UserRole.ADMIN), getStats);
router.get('/users', authenticateToken, requireRole(UserRole.ADMIN), getUsers);
router.put('/users/:id', authenticateToken, requireRole(UserRole.ADMIN), updateUserStatus);
router.get('/jobs', authenticateToken, requireRole(UserRole.ADMIN), getAdminJobs);
router.get('/payments', authenticateToken, requireRole(UserRole.ADMIN), getAdminPayments);

export default router;
