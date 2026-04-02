import { z } from 'zod';
import { safeString } from './shared.js';

export const registerSchema = z.object({
  email: z.email('Invalid email address').max(255).refine((s) => !s.includes('\x00'), 'Invalid characters in input'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
  role: z.enum(['customer', 'professional'], { error: 'Role must be customer or professional' }),
  firstName: safeString(z.string().min(1, 'First name is required').max(100, 'First name too long')),
  lastName: safeString(z.string().min(1, 'Last name is required').max(100, 'Last name too long')),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email('Invalid email address').refine((s) => !s.includes('\x00'), 'Invalid characters in input'),
  password: z.string().min(1, 'Password is required'),
});
