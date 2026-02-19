import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  createJob,
  getJobs,
  getJobById,
  acceptJob,
  updateJobStatus,
  getMyJobs,
  deleteJob,
} from '../controllers/jobs.controller.js';
import { UserRole } from '@tradeapp/shared';

const router = Router();

// Public — anyone logged in can browse all jobs
router.get('/', authenticateToken, getJobs);

// My jobs (customer sees theirs, professional sees theirs)
router.get('/mine', authenticateToken, getMyJobs);

// Single job detail
router.get('/:id', authenticateToken, getJobById);

// Customer creates a job
router.post('/', authenticateToken, requireRole(UserRole.CUSTOMER), createJob);

// Professional accepts a job
router.post('/:id/accept', authenticateToken, requireRole(UserRole.PROFESSIONAL), acceptJob);

// Either party updates status
router.put('/:id/status', authenticateToken, updateJobStatus);

// Customer permanently removes a cancelled job
router.delete('/:id', authenticateToken, requireRole(UserRole.CUSTOMER), deleteJob);

export default router;
