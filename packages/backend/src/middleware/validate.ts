import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validate(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      const field = first.path.length > 0 ? `${first.path.join('.')}: ` : '';
      res.status(400).json({ error: `${field}${first.message}` });
      return;
    }
    req.body = result.data;
    next();
  };
}
