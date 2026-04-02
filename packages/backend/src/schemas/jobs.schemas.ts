import { z } from 'zod';

export const createJobSchema = z.object({
  categoryId: z.number({ error: 'categoryId must be a number' }).int().positive('Invalid category'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: z.string().min(1, 'Description is required').max(5000, 'Description must be 5000 characters or fewer'),
  address: z.string().min(1, 'Address is required').max(500, 'Address too long'),
  location: z.object({
    latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
    longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
  }).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'emergency']).default('medium'),
  estimatedBudget: z.number().positive('Budget must be a positive number').max(1_000_000, 'Budget cannot exceed £1,000,000').optional().nullable(),
  scheduledDate: z.string().optional().nullable().refine(
    (d) => !d || new Date(d) > new Date(),
    'Scheduled date must be in the future'
  ),
});

export const updateJobStatusSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'cancelled'], {
    error: 'Status must be in_progress, completed, or cancelled',
  }),
});
