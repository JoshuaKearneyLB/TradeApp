import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { updateProfile, updateProfessionalProfile, getSkills, updateSkills } from '../controllers/profile.controller.js';
import { UserRole } from '@tradeapp/shared';

const router = Router();

// Any logged-in user can update their basic profile
router.put('/', authenticateToken, updateProfile);

// Professional-only endpoints
router.put('/professional', authenticateToken, requireRole(UserRole.PROFESSIONAL), updateProfessionalProfile);
router.get('/skills', authenticateToken, requireRole(UserRole.PROFESSIONAL), getSkills);
router.put('/skills', authenticateToken, requireRole(UserRole.PROFESSIONAL), updateSkills);

export default router;
