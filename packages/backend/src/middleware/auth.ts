import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { UserRole } from '@tradeapp/shared';
import { pool } from '../config/database.js';
import { isTokenRevoked, purgeExpiredTokens } from '../services/tokenBlacklist.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
    jti: string;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  jti: string;
}

// Purge expired revoked tokens every 30 minutes
setInterval(() => {
  purgeExpiredTokens().catch((err) => console.error('Token purge error:', err));
}, 30 * 60 * 1000);

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  // Reject excessively long tokens (DoS guard)
  if (token.length > 2048) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JWTPayload;

    // Verify account is still active
    const userResult = await pool.query(
      'SELECT account_status FROM users WHERE id = $1',
      [payload.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].account_status !== 'active') {
      res.status(403).json({ error: 'Account suspended or not found' });
      return;
    }

    // Check token has not been revoked (logout blacklist)
    if (payload.jti && await isTokenRevoked(payload.jti)) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(role: UserRole) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ error: `${role} role required` });
      return;
    }

    next();
  };
}

export function generateToken(payload: Omit<JWTPayload, 'jti'>): string {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }

  const jti = randomUUID();

  return jwt.sign({ ...payload, jti }, jwtSecret, {
    expiresIn: jwtExpiresIn,
    algorithm: 'HS256',
  });
}
