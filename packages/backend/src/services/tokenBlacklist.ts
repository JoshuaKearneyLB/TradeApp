import { pool } from '../config/database.js';

/**
 * Revoke a token by its jti (JWT ID).
 * expiresAt should match the token's exp so the row auto-cleans itself.
 */
export async function revokeToken(jti: string, expiresAt: Date): Promise<void> {
  await pool.query(
    'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [jti, expiresAt]
  );
}

/** Returns true if the token has been revoked. */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM revoked_tokens WHERE jti = $1',
    [jti]
  );
  return result.rows.length > 0;
}

/** Purge expired tokens — call periodically to keep the table lean. */
export async function purgeExpiredTokens(): Promise<void> {
  await pool.query('DELETE FROM revoked_tokens WHERE expires_at < NOW()');
}
