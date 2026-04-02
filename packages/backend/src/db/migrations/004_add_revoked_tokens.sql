-- Token blacklist for logout / revocation
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti       TEXT        PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Auto-cleanup: remove expired tokens so table doesn't grow forever
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens (expires_at);
