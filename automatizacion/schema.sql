CREATE TABLE IF NOT EXISTS solicitudes (
 id TEXT PRIMARY KEY, digest TEXT NOT NULL, payload TEXT NOT NULL,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS solicitudes_expiry ON solicitudes(expires_at);
CREATE TABLE IF NOT EXISTS eventos_canal (
 id TEXT PRIMARY KEY, canal TEXT NOT NULL, payload TEXT NOT NULL,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS eventos_canal_expiry ON eventos_canal(expires_at);
