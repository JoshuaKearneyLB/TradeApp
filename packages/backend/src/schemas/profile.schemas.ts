import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name cannot be empty').max(100, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name cannot be empty').max(100, 'Last name too long').optional(),
  phone: z.string().optional(),
});

export const updateProfessionalProfileSchema = z.object({
  bio: z.string().max(2000, 'Bio must be 2000 characters or fewer').optional().nullable(),
  hourlyRate: z.number().positive('Hourly rate must be positive').max(10000, 'Hourly rate too high').optional().nullable(),
  availabilityRadiusKm: z.number().int().min(1, 'Radius must be at least 1 km').max(500, 'Radius cannot exceed 500 km').optional(),
  isAvailable: z.boolean().optional(),
  location: z.object({
    latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
    longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
  }).optional().nullable(),
  locationDisplay: z.string().max(500).optional().nullable(),
});

export const updateSkillsSchema = z.object({
  skills: z.array(
    z.object({
      categoryId: z.number({ error: 'categoryId must be a number' }).int().positive('Invalid category'),
      yearsExperience: z.number().int().min(0).max(50, 'Years experience cannot exceed 50').optional().nullable(),
    })
  ).max(50, 'Cannot submit more than 50 skills at once'),
});
