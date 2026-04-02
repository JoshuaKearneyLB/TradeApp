import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { updateProfile, updateProfessionalProfile, getSkills, updateSkills } from '../controllers/profile.controller.js';
import { UserRole } from '@tradeapp/shared';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema, updateProfessionalProfileSchema, updateSkillsSchema } from '../schemas/profile.schemas.js';

const router = Router();

// Any logged-in user can update their basic profile
router.put('/', authenticateToken, validate(updateProfileSchema), updateProfile);

// Professional-only endpoints
router.put('/professional', authenticateToken, requireRole(UserRole.PROFESSIONAL), validate(updateProfessionalProfileSchema), updateProfessionalProfile);
router.get('/skills', authenticateToken, requireRole(UserRole.PROFESSIONAL), getSkills);
router.put('/skills', authenticateToken, requireRole(UserRole.PROFESSIONAL), validate(updateSkillsSchema), updateSkills);

export default router;
