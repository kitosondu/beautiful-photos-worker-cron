-- ============================================================
-- Photo Classifications Migration
-- Created: 2024-11-25
-- Description: Add photo classification tables with normalized schema
-- ============================================================

-- ============================================================
-- 1. Main Classification Table
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_classifications (
    photo_id VARCHAR PRIMARY KEY NOT NULL,

    -- Denormalized searchable field (space-separated tags)
    -- Example: "nature mountains snow no_people peaceful blue white sharp professional"
    all_tags_searchable TEXT NOT NULL,

    -- Classification metadata
    classification_status VARCHAR NOT NULL DEFAULT 'pending',
    confidence_score REAL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_ts INTEGER,
    completed_ts INTEGER,
    error_message TEXT,

    FOREIGN KEY (photo_id) REFERENCES photos(photo_id) ON DELETE CASCADE
);

-- ============================================================
-- 2. Tag Dictionary (All Unique Tags)
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name VARCHAR NOT NULL UNIQUE,
    tag_category VARCHAR NOT NULL, -- 'content', 'people', 'mood', 'color', 'quality'
    usage_count INTEGER DEFAULT 0,
    created_ts INTEGER NOT NULL
);

-- ============================================================
-- 3. Photo-Tag Relationships (Many-to-Many)
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_tags (
    photo_id VARCHAR NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (photo_id, tag_id),
    FOREIGN KEY (photo_id) REFERENCES photo_classifications(photo_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id)
);

-- ============================================================
-- 4. Classification Logs (Critical Events Only)
-- ============================================================
CREATE TABLE IF NOT EXISTS classification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    photo_id VARCHAR NOT NULL,
    event_type VARCHAR NOT NULL, -- 'attempt', 'success', 'error', 'model_fallback'
    model_used VARCHAR,           -- 'free' or 'paid'
    error_message TEXT,
    processing_time_ms INTEGER,
    confidence_score REAL
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- photo_classifications indexes
CREATE INDEX IF NOT EXISTS idx_classification_status
    ON photo_classifications(classification_status);

CREATE INDEX IF NOT EXISTS idx_classification_completed
    ON photo_classifications(completed_ts)
    WHERE completed_ts IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classification_pending
    ON photo_classifications(classification_status, retry_count)
    WHERE classification_status IN ('pending', 'failed');

-- tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(tag_category);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags(usage_count DESC);

-- photo_tags indexes
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON photo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo ON photo_tags(photo_id);

-- classification_logs indexes
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON classification_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_photo ON classification_logs(photo_id);
CREATE INDEX IF NOT EXISTS idx_logs_event ON classification_logs(event_type);

-- ============================================================
-- Full-Text Search (FTS5)
-- ============================================================

CREATE VIRTUAL TABLE IF NOT EXISTS photo_classifications_fts USING fts5(
    photo_id UNINDEXED,
    all_tags,
    content='photo_classifications',
    content_rowid='rowid'
);

-- ============================================================
-- Triggers for FTS Synchronization
-- ============================================================

CREATE TRIGGER IF NOT EXISTS photo_classifications_fts_insert
AFTER INSERT ON photo_classifications
BEGIN
    INSERT INTO photo_classifications_fts(rowid, photo_id, all_tags)
    VALUES (new.rowid, new.photo_id, new.all_tags_searchable);
END;

CREATE TRIGGER IF NOT EXISTS photo_classifications_fts_update
AFTER UPDATE ON photo_classifications
BEGIN
    UPDATE photo_classifications_fts
    SET all_tags = new.all_tags_searchable
    WHERE rowid = new.rowid;
END;

CREATE TRIGGER IF NOT EXISTS photo_classifications_fts_delete
AFTER DELETE ON photo_classifications
BEGIN
    DELETE FROM photo_classifications_fts
    WHERE rowid = old.rowid;
END;
