# Database Schema - Photo Classifications

## Overview

This document outlines the database schema for storing photo classifications. The final design uses a **normalized approach with denormalized search field** to achieve:
- **Tag Reusability**: Unique tags stored once with usage statistics
- **Referential Integrity**: Consistent tag relationships
- **Fast Search**: Denormalized `all_tags_searchable` field + FTS5
- **Analytics**: Track tag frequency and popularity

## Final Schema Design: Normalized with Search Optimization

This approach combines the benefits of normalization (tag consistency, statistics) with fast search performance through a denormalized search field.

### Architecture

```
photo_classifications (main table)
    ├── all_tags_searchable (denormalized for fast search)
    └── metadata (status, confidence, timestamps)

tags (tag dictionary)
    └── tag metadata (name, category, usage_count)

photo_tags (many-to-many relationship)
    └── links photos to tags

classification_logs (audit trail)
    └── critical events (errors, model fallbacks)

photo_classifications_fts (FTS5 virtual table)
    └── full-text search on all_tags_searchable
```

## Complete Schema Definition

```sql
-- ============================================================
-- 1. Main Classification Table
-- ============================================================
CREATE TABLE photo_classifications (
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
CREATE TABLE tags (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name VARCHAR NOT NULL UNIQUE,
    tag_category VARCHAR NOT NULL, -- 'content', 'people', 'mood', 'color', 'quality'
    usage_count INTEGER DEFAULT 0,
    created_ts INTEGER NOT NULL
);

-- ============================================================
-- 3. Photo-Tag Relationships (Many-to-Many)
-- ============================================================
CREATE TABLE photo_tags (
    photo_id VARCHAR NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (photo_id, tag_id),
    FOREIGN KEY (photo_id) REFERENCES photo_classifications(photo_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id)
);

-- ============================================================
-- 4. Classification Logs (Critical Events Only)
-- ============================================================
CREATE TABLE classification_logs (
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
CREATE INDEX idx_classification_status 
    ON photo_classifications(classification_status);

CREATE INDEX idx_classification_completed 
    ON photo_classifications(completed_ts) 
    WHERE completed_ts IS NOT NULL;

CREATE INDEX idx_classification_pending 
    ON photo_classifications(classification_status, retry_count) 
    WHERE classification_status IN ('pending', 'failed');

-- tags indexes
CREATE INDEX idx_tags_category ON tags(tag_category);
CREATE INDEX idx_tags_name ON tags(tag_name);
CREATE INDEX idx_tags_usage ON tags(usage_count DESC);

-- photo_tags indexes
CREATE INDEX idx_photo_tags_tag ON photo_tags(tag_id);
CREATE INDEX idx_photo_tags_photo ON photo_tags(photo_id);

-- classification_logs indexes
CREATE INDEX idx_logs_timestamp ON classification_logs(timestamp);
CREATE INDEX idx_logs_photo ON classification_logs(photo_id);
CREATE INDEX idx_logs_event ON classification_logs(event_type);

-- ============================================================
-- Full-Text Search (FTS5)
-- ============================================================

CREATE VIRTUAL TABLE photo_classifications_fts USING fts5(
    photo_id UNINDEXED,
    all_tags,
    content='photo_classifications',
    content_rowid='rowid'
);

-- ============================================================
-- Triggers for FTS Synchronization
-- ============================================================

CREATE TRIGGER photo_classifications_fts_insert 
AFTER INSERT ON photo_classifications 
BEGIN
    INSERT INTO photo_classifications_fts(rowid, photo_id, all_tags)
    VALUES (new.rowid, new.photo_id, new.all_tags_searchable);
END;

CREATE TRIGGER photo_classifications_fts_update 
AFTER UPDATE ON photo_classifications 
BEGIN
    UPDATE photo_classifications_fts 
    SET all_tags = new.all_tags_searchable
    WHERE rowid = new.rowid;
END;

CREATE TRIGGER photo_classifications_fts_delete 
AFTER DELETE ON photo_classifications 
BEGIN
    DELETE FROM photo_classifications_fts 
    WHERE rowid = old.rowid;
END;
```

## Data Types (TypeScript)

```typescript
interface PhotoClassification {
  photo_id: string;
  all_tags_searchable: string;    // Space-separated tags
  classification_status: 'pending' | 'completed' | 'failed';
  confidence_score: number | null;
  retry_count: number;
  last_attempt_ts: number | null;
  completed_ts: number | null;
  error_message: string | null;
}

interface Tag {
  tag_id: number;
  tag_name: string;
  tag_category: 'content' | 'people' | 'mood' | 'color' | 'quality';
  usage_count: number;
  created_ts: number;
}

interface PhotoTag {
  photo_id: string;
  tag_id: number;
}

interface ClassificationLog {
  id: number;
  timestamp: number;
  photo_id: string;
  event_type: 'attempt' | 'success' | 'error' | 'model_fallback';
  model_used: 'free' | 'paid' | null;
  error_message: string | null;
  processing_time_ms: number | null;
  confidence_score: number | null;
}

interface ClassificationResult {
  content_tags: string[];
  people_tags: string[];
  mood_tags: string[];
  color_tags: string[];
  quality_tags: string[];
  confidence_score: number;
}
```

## Save Classification Implementation

```typescript
async function saveClassification(
  db: D1Database,
  photoId: string,
  classification: ClassificationResult
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // 1. Collect all tags into one array
  const allTagsArray = [
    ...classification.content_tags,
    ...classification.people_tags,
    ...classification.mood_tags,
    ...classification.color_tags,
    ...classification.quality_tags
  ];
  
  // 2. Create searchable string (space-separated)
  const allTagsSearchable = allTagsArray.join(' ');
  
  // 3. Insert/Update photo_classifications
  await db.prepare(`
    INSERT INTO photo_classifications (
      photo_id, 
      all_tags_searchable, 
      classification_status, 
      confidence_score, 
      retry_count, 
      last_attempt_ts, 
      completed_ts
    ) VALUES (?, ?, 'completed', ?, 0, ?, ?)
    ON CONFLICT(photo_id) DO UPDATE SET
      all_tags_searchable = excluded.all_tags_searchable,
      classification_status = 'completed',
      confidence_score = excluded.confidence_score,
      last_attempt_ts = excluded.last_attempt_ts,
      completed_ts = excluded.completed_ts,
      error_message = NULL
  `).bind(photoId, allTagsSearchable, classification.confidence_score, now, now).run();
  
  // 4. Delete old photo_tags relationships for this photo
  await db.prepare(`DELETE FROM photo_tags WHERE photo_id = ?`).bind(photoId).run();
  
  // 5. Process each category of tags
  const categories = [
    { tags: classification.content_tags, category: 'content' },
    { tags: classification.people_tags, category: 'people' },
    { tags: classification.mood_tags, category: 'mood' },
    { tags: classification.color_tags, category: 'color' },
    { tags: classification.quality_tags, category: 'quality' }
  ];
  
  for (const { tags, category } of categories) {
    for (const tagName of tags) {
      // 5.1. Insert tag or increment usage_count
      await db.prepare(`
        INSERT INTO tags (tag_name, tag_category, created_ts, usage_count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(tag_name) DO UPDATE SET
          usage_count = usage_count + 1
      `).bind(tagName, category, now).run();
      
      // 5.2. Get tag_id
      const tagResult = await db.prepare(`
        SELECT tag_id FROM tags WHERE tag_name = ?
      `).bind(tagName).first<{ tag_id: number }>();
      
      if (tagResult) {
        // 5.3. Link photo to tag
        await db.prepare(`
          INSERT OR IGNORE INTO photo_tags (photo_id, tag_id)
          VALUES (?, ?)
        `).bind(photoId, tagResult.tag_id).run();
      }
    }
  }
}
```

## Query Examples

### 1. Get Classification with Tags by Category

```typescript
async function getPhotoClassification(
  db: D1Database, 
  photoId: string
): Promise<PhotoClassification & ClassificationResult> {
  // Get main classification data
  const classification = await db.prepare(`
    SELECT * FROM photo_classifications WHERE photo_id = ?
  `).bind(photoId).first<PhotoClassification>();
  
  if (!classification) {
    throw new Error('Classification not found');
  }
  
  // Get tags grouped by category
  const tagsResult = await db.prepare(`
    SELECT t.tag_name, t.tag_category
    FROM photo_tags pt
    JOIN tags t ON pt.tag_id = t.tag_id
    WHERE pt.photo_id = ?
    ORDER BY t.tag_category, t.tag_name
  `).bind(photoId).all<{ tag_name: string; tag_category: string }>();
  
  // Group tags by category
  const result = {
    ...classification,
    content_tags: [] as string[],
    people_tags: [] as string[],
    mood_tags: [] as string[],
    color_tags: [] as string[],
    quality_tags: [] as string[]
  };
  
  for (const row of tagsResult.results) {
    result[`${row.tag_category}_tags`].push(row.tag_name);
  }
  
  return result;
}
```

### 2. Fast Search via all_tags_searchable

```typescript
// Simple LIKE search (fast with index)
async function searchPhotosByTags(
  db: D1Database,
  requiredTags: string[],
  excludedTags: string[] = []
) {
  let conditions = ['pc.classification_status = ?'];
  const bindings = ['completed'];
  
  // Add required tags
  for (const tag of requiredTags) {
    conditions.push('pc.all_tags_searchable LIKE ?');
    bindings.push(`%${tag}%`);
  }
  
  // Add excluded tags
  for (const tag of excludedTags) {
    conditions.push('pc.all_tags_searchable NOT LIKE ?');
    bindings.push(`%${tag}%`);
  }
  
  const query = `
    SELECT p.* 
    FROM photos p
    JOIN photo_classifications pc ON p.photo_id = pc.photo_id
    WHERE ${conditions.join(' AND ')}
  `;
  
  return await db.prepare(query).bind(...bindings).all();
}

// FTS5 full-text search (even faster for complex queries)
async function fullTextSearch(db: D1Database, searchQuery: string) {
  return await db.prepare(`
    SELECT p.*, pc.confidence_score
    FROM photos p
    JOIN photo_classifications pc ON p.photo_id = pc.photo_id
    JOIN photo_classifications_fts fts ON fts.photo_id = pc.photo_id
    WHERE fts.all_tags MATCH ?
      AND pc.classification_status = 'completed'
    ORDER BY fts.rank
  `).bind(searchQuery).all();
}

// Example FTS5 queries:
// - "nature AND no_people" - both tags required
// - "nature OR architecture" - either tag
// - "nature NOT people" - nature but not people
// - "mount*" - prefix matching (mountain, mountains, etc.)
```

### 3. Tag Statistics

```sql
-- Top 20 most used tags
SELECT tag_name, tag_category, usage_count
FROM tags
ORDER BY usage_count DESC
LIMIT 20;

-- Tags by category with stats
SELECT 
  tag_category, 
  COUNT(*) as unique_tags, 
  SUM(usage_count) as total_usage,
  AVG(usage_count) as avg_usage
FROM tags
GROUP BY tag_category;

-- Unused or rarely used tags
SELECT tag_name, tag_category, usage_count
FROM tags
WHERE usage_count < 5
ORDER BY usage_count ASC, tag_name;
```

### 4. Find Similar Photos

```sql
-- Photos with at least 3 common tags
SELECT 
  p2.photo_id,
  COUNT(*) as common_tags,
  GROUP_CONCAT(t.tag_name, ', ') as shared_tags
FROM photo_tags pt1
JOIN photo_tags pt2 ON pt1.tag_id = pt2.tag_id AND pt1.photo_id != pt2.photo_id
JOIN tags t ON pt1.tag_id = t.tag_id
JOIN photos p2 ON pt2.photo_id = p2.photo_id
WHERE pt1.photo_id = ?
GROUP BY p2.photo_id
HAVING common_tags >= 3
ORDER BY common_tags DESC
LIMIT 10;
```

### 5. Get Unclassified Photos

```typescript
async function getUnclassifiedPhotos(
  db: D1Database, 
  limit: number = 5
): Promise<Photo[]> {
  return await db.prepare(`
    SELECT p.*
    FROM photos p
    LEFT JOIN photo_classifications pc ON p.photo_id = pc.photo_id
    WHERE pc.photo_id IS NULL 
       OR (pc.classification_status = 'failed' AND pc.retry_count < 3)
    ORDER BY p.created_ts DESC
    LIMIT ?
  `).bind(limit).all();
}
```

## Migration Script

```sql
-- migrations/002_photo_classifications.sql

-- ============================================================
-- Create Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS photo_classifications (
    photo_id VARCHAR PRIMARY KEY NOT NULL,
    all_tags_searchable TEXT NOT NULL,
    classification_status VARCHAR NOT NULL DEFAULT 'pending',
    confidence_score REAL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_ts INTEGER,
    completed_ts INTEGER,
    error_message TEXT,
    FOREIGN KEY (photo_id) REFERENCES photos(photo_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name VARCHAR NOT NULL UNIQUE,
    tag_category VARCHAR NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS photo_tags (
    photo_id VARCHAR NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (photo_id, tag_id),
    FOREIGN KEY (photo_id) REFERENCES photo_classifications(photo_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id)
);

CREATE TABLE IF NOT EXISTS classification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    photo_id VARCHAR NOT NULL,
    event_type VARCHAR NOT NULL,
    model_used VARCHAR,
    error_message TEXT,
    processing_time_ms INTEGER,
    confidence_score REAL
);

-- ============================================================
-- Create Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_classification_status 
    ON photo_classifications(classification_status);

CREATE INDEX IF NOT EXISTS idx_classification_completed 
    ON photo_classifications(completed_ts) 
    WHERE completed_ts IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classification_pending 
    ON photo_classifications(classification_status, retry_count) 
    WHERE classification_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(tag_category);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON photo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo ON photo_tags(photo_id);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON classification_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_photo ON classification_logs(photo_id);
CREATE INDEX IF NOT EXISTS idx_logs_event ON classification_logs(event_type);

-- ============================================================
-- Create FTS5 Virtual Table
-- ============================================================

CREATE VIRTUAL TABLE IF NOT EXISTS photo_classifications_fts USING fts5(
    photo_id UNINDEXED,
    all_tags,
    content='photo_classifications',
    content_rowid='rowid'
);

-- ============================================================
-- Create Triggers
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
```

## Performance Characteristics

### Storage Estimates
- **photo_classifications**: ~100-300 bytes per photo (searchable text)
- **tags**: ~30 bytes per unique tag (~200-500 unique tags expected)
- **photo_tags**: ~16 bytes per relationship (~10-15 per photo)
- **classification_logs**: ~100 bytes per critical log entry
- **FTS5 index**: ~150-400 bytes per photo

**Total per 10,000 photos**: ~5-10 MB

### Query Performance
- **LIKE search on all_tags_searchable**: Very fast with proper indexing
- **FTS5 search**: Fastest for complex boolean queries
- **JOIN queries via photo_tags**: Fast with proper indexes
- **Tag statistics**: Fast with usage_count index

### Benefits of This Design

✅ **Tag Normalization**: All unique tags in one place  
✅ **Usage Statistics**: Track tag popularity automatically  
✅ **Fast Search**: Denormalized field + FTS5  
✅ **Referential Integrity**: Consistent relationships  
✅ **Analytics Ready**: Easy to analyze tag patterns  
✅ **Similar Photos**: Find photos with common tags  
✅ **Tag Management**: Easy to rename/merge tags  

## Future Enhancements

1. **Tag Synonyms Table**: Map similar tags (e.g., "ocean" ↔ "sea")
2. **Tag Hierarchy**: Parent-child relationships (e.g., "nature" → "mountains")
3. **User Tag Preferences**: Store user-specific tag weights
4. **Tag Recommendations**: Suggest tags based on co-occurrence
5. **Batch Tag Operations**: Bulk update/merge tags
6. **Tag Descriptions**: Add human-readable descriptions to tags
