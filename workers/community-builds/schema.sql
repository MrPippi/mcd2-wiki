-- Community builds: shared build planner links, liked and reported anonymously (D1 / SQLite).
CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,          -- the build page query string, normalized (see validate.ts)
  title TEXT NOT NULL,
  lang TEXT NOT NULL,                 -- the site language it was published from
  game_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,        -- Unix seconds
  author TEXT NOT NULL,               -- salted hash of the publisher's IP, for the hourly limit
  votes INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS builds_top ON builds (hidden, votes DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS builds_new ON builds (hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS builds_author ON builds (author, created_at);

CREATE TABLE IF NOT EXISTS votes (
  build_id TEXT NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
  voter TEXT NOT NULL,                -- salted hash of the browser's random id
  PRIMARY KEY (build_id, voter)
);

CREATE TABLE IF NOT EXISTS reports (
  build_id TEXT NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
  voter TEXT NOT NULL,
  PRIMARY KEY (build_id, voter)
);
