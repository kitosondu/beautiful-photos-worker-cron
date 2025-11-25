-- ============================================================
-- Fix FTS5 Table Configuration
-- Created: 2024-11-25
-- Description: Recreate FTS5 table without content parameter to avoid column mapping issues
-- ============================================================

-- Drop existing FTS table and triggers
DROP TRIGGER IF EXISTS photo_classifications_fts_insert;
DROP TRIGGER IF EXISTS photo_classifications_fts_update;
DROP TRIGGER IF EXISTS photo_classifications_fts_delete;
DROP TABLE IF EXISTS photo_classifications_fts;

-- Recreate FTS5 table without content parameter (standalone mode)
-- This avoids the column mapping issue with T.all_tags
CREATE VIRTUAL TABLE IF NOT EXISTS photo_classifications_fts USING fts5(
    photo_id UNINDEXED,
    all_tags
);

-- Recreate triggers with corrected logic
CREATE TRIGGER IF NOT EXISTS photo_classifications_fts_insert
AFTER INSERT ON photo_classifications
BEGIN
    INSERT INTO photo_classifications_fts(photo_id, all_tags)
    VALUES (new.photo_id, new.all_tags_searchable);
END;

CREATE TRIGGER IF NOT EXISTS photo_classifications_fts_update
AFTER UPDATE ON photo_classifications
BEGIN
    DELETE FROM photo_classifications_fts WHERE photo_id = old.photo_id;
    INSERT INTO photo_classifications_fts(photo_id, all_tags)
    VALUES (new.photo_id, new.all_tags_searchable);
END;

CREATE TRIGGER IF NOT EXISTS photo_classifications_fts_delete
AFTER DELETE ON photo_classifications
BEGIN
    DELETE FROM photo_classifications_fts WHERE photo_id = old.photo_id;
END;
