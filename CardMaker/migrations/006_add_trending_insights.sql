-- Migration 006: Add trending_insights table for AI analysis of trending videos
CREATE TABLE IF NOT EXISTS trending_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  videoCount INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  themes TEXT NOT NULL, -- JSON array
  formats TEXT NOT NULL, -- JSON array
  recommendations TEXT NOT NULL, -- JSON array
  generatedAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trending_insights_userId
  ON trending_insights(userId, generatedAt DESC);

CREATE INDEX IF NOT EXISTS idx_trending_insights_createdAt
  ON trending_insights(createdAt DESC);
