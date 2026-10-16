CREATE TABLE IF NOT EXISTS solicitudes (
 id TEXT PRIMARY KEY, digest TEXT NOT NULL, payload TEXT NOT NULL,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS solicitudes_expiry ON solicitudes(expires_at);
