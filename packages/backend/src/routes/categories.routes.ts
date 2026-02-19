import { Router } from 'express';
import { getCategories } from '../controllers/categories.controller.js';

const router = Router();

// Public — no auth needed
router.get('/', getCategories);

export default router;
