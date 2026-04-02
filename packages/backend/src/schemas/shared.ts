import { z } from 'zod';

/** Reject strings containing null bytes, which can bypass string length checks in some DBs */
export const safeString = (base: z.ZodString) =>
  base.refine((s) => !s.includes('\x00'), 'Invalid characters in input');
