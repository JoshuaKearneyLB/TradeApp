import { z } from 'zod';

export const createRatingSchema = z.object({
  jobId: z.uuid('Invalid job ID'),
  rating: z.number({ error: 'Rating must be a number' }).int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().max(1000, 'Comment must be 1000 characters or fewer').optional().nullable(),
});
