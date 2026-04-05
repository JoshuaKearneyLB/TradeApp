import { z } from 'zod';

export const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
});
