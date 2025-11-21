# Database Schema - Photo Classifications

## Overview

This document outlines the database schema for storing photo classifications. The design needs to balance between:
- **Query Performance**: Fast filtering by tags
- **Storage Efficiency**: Minimal redundancy
- **Flexibility**: Support for dynamic tag lists
- **Maintainability**: Easy to understand and update

## Schema Options Analysis

### Option 1: JSON Columns (Current Draft)

```sql
CREATE TABLE photo_classifications (
    photo_id VARCHAR PRIMARY KEY NOT NULL,
    
    -- Structured tags as JSON arrays
    content_tags TEXT,      -- JSON: ["nature", "mountains"]
    people_tags TEXT,       -- JSON: ["no_people"]
    mood_tags TEXT,         -- JSON: ["peaceful", "serene"]
    color_tags TEXT,        -- JSON: ["blue", "white"]
    quality_tags TEXT,      -- JSON: ["sharp", "professional"]
    
    -- Metadata
    classification_status VARCHAR NOT NULL DEFAULT 'pending',
    confidence_score REAL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_ts INTEGER,
    completed_ts INTEGER,
    error_message TEXT,
    
    FOREIGN KEY (photo_id) REFERENCES photos(photo_id)
);

CREATE INDEX idx_classification_status ON photo_classifications(classification_status);
CREATE INDEX idx_classification_retry ON photo_classifications(classification_status, retry_count);
CREATE INDEX idx_classification_completed ON photo_classifications(completed_ts);
```

**Pros:**
- Simple schema, easy to implement
- Flexible - can add any tags without schema changes
- Compact storage
- Natural fit for LLM JSON output

**Cons:**
- Filtering requires JSON functions (SQLite `json_extract`, `json_each`)
- Less efficient for complex queries
- No referential integrity on tags
- Index optimization limited

**Query Example:**
```sql
-- Find photos with "nature" content tag and "no_people"
SELECT p.* FROM photos p
JOIN photo_classifications pc ON p.photo_id = pc.photo_id
WHERE pc.content_tags LIKE '%"nature"%'
  AND pc.people_tags LIKE '%"no_people"%'
  AND pc.classification_status = 'completed';
```

---

### Option 2: Normalized Tags (Separate Tables)

```sql
-- Main classification table
CREATE TABLE photo_classifications (
    photo_id VARCHAR PRIMARY KEY NOT NULL,
    classification_status VARCHAR NOT NULL DEFAULT 'pending',
    confidence_score REAL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_ts INTEGER,
    completed_ts INTEGER,
    error_message TEXT,
    FOREIGN KEY (photo_id) REFERENCES photos(photo_id)
);

-- Tag dictionary (all unique tags)
CREATE TABLE tags (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name VARCHAR NOT NULL UNIQUE,
    tag_category VARCHAR NOT NULL, -- 'content', 'people', 'mood', 'color', 'quality'
    usage_count INTEGER DEFAULT 0
);

-- Photo-tag relationships
CREATE TABLE photo_tags (
    photo_id VARCHAR NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (photo_id, tag_id),
    FOREIGN KEY (photo_id) REFERENCES photo_classifications(photo_id),
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id)
);

-- Indexes
CREATE INDEX idx_classification_status ON photo_classifications(classification_status);
CREATE INDEX idx_classification_completed ON photo_classifications(completed_ts);
CREATE INDEX idx_photo_tags_tag ON photo_tags(tag_id);
CREATE INDEX idx_photo_tags_photo ON photo_tags(photo_id);
CREATE INDEX idx_tags_category ON tags(tag_category);
CREATE INDEX idx_tags_name ON tags(tag_name);
```

**Pros:**
- Optimal query performance with proper indexes
- Tag reuse and consistency
- Can track tag usage statistics
- Referential integrity enforced
- Easy to add tag metadata (descriptions, synonyms)

**Cons:**
- More complex schema
- Multiple table inserts per classification
- More storage overhead
- Requires tag normalization logic

**Query Example:**
```sql
-- Find photos with "nature" content tag and "no_people"
SELECT DISTINCT p.* FROM photos p
JOIN photo_classifications pc ON p.photo_id = pc.photo_id
JOIN photo_tags pt1 ON pc.photo_id = pt1.photo_id
JOIN tags t1 ON pt1.tag_id = t1.tag_id AND t1.tag_name = 'nature'
JOIN photo_tags pt2 ON pc.photo_id = pt2.photo_id
JOIN tags t2 ON pt2.tag_id = t2.tag_id AND t2.tag_name = 'no_people'
WHERE pc.classification_status = 'completed';
```

---

### Option 3: Hybrid Approach (Recommended)

```sql
-- Main classification table with JSON for flexibility
CREATE TABLE photo_classifications (
    photo_id VARCHAR PRIMARY KEY NOT NULL,
    
    -- JSON arrays for all tags (easy to work with)
    content_tags TEXT,      -- JSON: ["nature", "mountains"]
    people_tags TEXT,       -- JSON: ["no_people"]
    mood_tags TEXT,         -- JSON: ["peaceful", "serene"]
    color_tags TEXT,        -- JSON: ["blue", "white"]
    quality_tags TEXT,      -- JSON: ["sharp", "professional"]
    
    -- Denormalized searchable text for fast LIKE queries
    all_tags_searchable TEXT, -- Space-separated: "nature mountains no_people peaceful serene blue white sharp professional"
    
    -- Metadata
    classification_status VARCHAR NOT NULL DEFAULT 'pending',
    confidence_score REAL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_ts INTEGER,
    completed_ts INTEGER,
    error_message TEXT,
    
    FOREIGN KEY (photo_id) REFERENCES photos(photo_id)
);

-- Indexes
CREATE INDEX idx_classification_status ON photo_classifications(classification_status);
CREATE INDEX idx_classification_completed ON photo_classifications(completed_ts);
CREATE INDEX idx_classification_retry ON photo_classifications(classification_status, retry_count);

-- Full-text search index (SQLite FTS5)
CREATE VIRTUAL TABLE photo_classifications_fts USING fts5(
    photo_id UNINDEXED,
    all_tags,
    content='photo_classifications',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER photo_classifications_ai AFTER INSERT ON photo_classifications BEGIN
    INSERT INTO photo_classifications_fts(rowid, photo_id, all_tags)
    VALUES (new.rowid, new.photo_id, new.all_tags_searchable);
END;

CREATE TRIGGER photo_classifications_au AFTER UPDATE ON photo_classifications BEGIN
    UPDATE photo_classifications_fts 
    SET all_tags = new.all_tags_searchable
    WHERE rowid = new.rowid;
END;

CREATE TRIGGER photo_classifications_ad AFTER DELETE ON photo_classifications BEGIN
    DELETE FROM photo_classifications_fts WHERE rowid = old.rowid;
END;
```

**Pros:**
- Best of both worlds: JSON flexibility + search performance
- Fast full-text search with FTS5
- Simple insert logic
- Supports complex filtering
- Easy to add new categories

**Cons:**
- Slight storage overhead for denormalized field
- Need to maintain `all_tags_searchable` field
- FTS5 adds complexity

**Query Examples:**
```sql
-- Simple LIKE query (fast with denormalized field)
SELECT p.* FROM photos p
JOIN photo_classifications pc ON p.photo_id = pc.photo_id
WHERE pc.all_tags_searchable LIKE '%nature%'
  AND pc.all_tags_searchable LIKE '%no_people%'
  AND pc.classification_status = 'completed';

-- Full-text search (even faster, supports complex queries)
SELECT p.* FROM photos p
JOIN photo_classifications pc ON p.photo_id = pc.photo_id
JOIN photo_classifications_fts fts ON fts.photo_id = pc.photo_id
WHERE fts.all_tags MATCH 'nature AND no_people'
  AND pc.classification_status = 'completed';

-- Natural language style query
SELECT p.* FROM photos p
JOIN photo_classifications pc ON p.photo_id = pc.photo_id
JOIN photo_classifications_fts fts ON fts.photo_id = pc.photo_id
WHERE fts.all_tags MATCH 'nature OR architecture'
  AND pc.all_tags_searchable LIKE '%no_people%'
  AND pc.classification_status = 'completed';
```

---

## Recommended Schema (Hybrid Approach)

### Complete Schema Definition

```sql
-- Main classification table
CREATE TABLE photo_classifications (
    photo_id VARCHAR PRIMARY KEY NOT NULL,
    
    -- Tag categories as JSON arrays
    content_tags TEXT NOT NULL,         -- JSON array
    people_tags TEXT NOT NULL,          -- JSON array
    mood_tags TEXT NOT NULL,            -- JSON array
    color_tags TEXT NOT NULL,           -- JSON array
    quality_tags TEXT NOT NULL,         -- JSON array
    
    -- Denormalized searchable field (space-separated tags)
    all_tags_searchable TEXT NOT NULL,
    
    -- Classification metadata
    classification_status VARCHAR NOT NULL DEFAULT 'pending',
    confidence_score REAL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_ts INTEGER,
    completed_ts INTEGER,
    error_message TEXT,
    
    -- Foreign key
    FOREIGN KEY (photo_id) REFERENCES photos(photo_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_classification_status 
    ON photo_classifications(classification_status);

CREATE INDEX idx_classification_completed 
    ON photo_classifications(completed_ts) 
    WHERE completed_ts IS NOT NULL;

CREATE INDEX idx_classification_pending 
    ON photo_classifications(classification_status, retry_count) 
    WHERE classification_status = 'pending' OR classification_status = 'failed';

-- Full-text search virtual table
CREATE VIRTUAL TABLE photo_classifications_fts USING fts5(
    photo_id UNINDEXED,
    all_tags,
    content='photo_classifications',
    content_rowid='rowid'
);

-- Triggers to maintain FTS index
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

### Data Types

```typescript
interface PhotoClassificationRow {
  photo_id: string;
  content_tags: string;           // JSON array as text
  people_tags: string;            // JSON array as text
  mood_tags: string;              // JSON array as text
  color_tags: string;             // JSON array as text
  quality_tags: string;           // JSON array as text
  all_tags_searchable: string;    // Space-separated tags
  classification_status: 'pending' | 'completed' | 'failed';
  confidence_score: number | null;
  retry_count: number;
  last_attempt_ts: number | null;
  completed_ts: number | null;
  error_message: string | null;
}
```

### Insert Example

```typescript
async function saveClassification(
  db: D1Database,
  photoId: string,
  classification: ClassificationResult
) {
  // Prepare JSON strings
  const contentTags = JSON.stringify(classification.content_tags);
  const peopleTags = JSON.stringify(classification.people_tags);
  const moodTags = JSON.stringify(classification.mood_tags);
  const colorTags = JSON.stringify(classification.color_tags);
  const qualityTags = JSON.stringify(classification.quality_tags);
  
  // Build searchable text (all tags space-separated)
  const allTags = [
    ...classification.content_tags,
    ...classification.people_tags,
    ...classification.mood_tags,
    ...classification.color_tags,
    ...classification.quality_tags
  ].join(' ');
  
  const now = Math.round(Date.now() / 1000);
  
  await db.prepare(`
    INSERT INTO photo_classifications (
      photo_id,
      content_tags,
      people_tags,
      mood_tags,
      color_tags,
      quality_tags,
      all_tags_searchable,
      classification_status,
      confidence_score,
      retry_count,
      last_attempt_ts,
      completed_ts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(photo_id) DO UPDATE SET
      content_tags = excluded.content_tags,
      people_tags = excluded.people_tags,
      mood_tags = excluded.mood_tags,
      color_tags = excluded.color_tags,
      quality_tags = excluded.quality_tags,
      all_tags_searchable = excluded.all_tags_searchable,
      classification_status = excluded.classification_status,
      confidence_score = excluded.confidence_score,
      last_attempt_ts = excluded.last_attempt_ts,
      completed_ts = excluded.completed_ts
  `)
  .bind(
    photoId,
    contentTags,
    peopleTags,
    moodTags,
    colorTags,
    qualityTags,
    allTags,
    'completed',
    classification.confidence_score,
    0,
    now,
    now
  )
  .run();
}
```

### Query Examples

```typescript
// 1. Get unclassified photos
async function getUnclassifiedPhotos(db: D1Database, limit: number = 5) {
  return await db.prepare(`
    SELECT p.photo_id, p.data_json
    FROM photos p
    LEFT JOIN photo_classifications pc ON p.photo_id = pc.photo_id
    WHERE pc.photo_id IS NULL 
       OR (pc.classification_status = 'failed' AND pc.retry_count < 3)
    ORDER BY p.created_ts DESC
    LIMIT ?
  `).bind(limit).all();
}

// 2. Simple tag filtering
async function getPhotosByTags(
  db: D1Database,
  requiredTags: string[],
  excludedTags: string[] = []
) {
  let query = `
    SELECT p.*, pc.content_tags, pc.people_tags, pc.mood_tags, 
           pc.color_tags, pc.quality_tags, pc.confidence_score
    FROM photos p
    JOIN photo_classifications pc ON p.photo_id = pc.photo_id
    WHERE pc.classification_status = 'completed'
  `;
  
  // Add required tags
  for (const tag of requiredTags) {
    query += ` AND pc.all_tags_searchable LIKE '%${tag}%'`;
  }
  
  // Exclude tags
  for (const tag of excludedTags) {
    query += ` AND pc.all_tags_searchable NOT LIKE '%${tag}%'`;
  }
  
  return await db.prepare(query).all();
}

// 3. Full-text search
async function searchPhotosByText(db: D1Database, searchQuery: string) {
  return await db.prepare(`
    SELECT p.*, pc.content_tags, pc.people_tags, pc.mood_tags,
           pc.color_tags, pc.quality_tags
    FROM photos p
    JOIN photo_classifications pc ON p.photo_id = pc.photo_id
    JOIN photo_classifications_fts fts ON fts.photo_id = pc.photo_id
    WHERE fts.all_tags MATCH ?
      AND pc.classification_status = 'completed'
    ORDER BY fts.rank
  `).bind(searchQuery).all();
}

// 4. Classification statistics
async function getClassificationStats(db: D1Database) {
  return await db.prepare(`
    SELECT 
      classification_status,
      COUNT(*) as count,
      AVG(confidence_score) as avg_confidence
    FROM photo_classifications
    GROUP BY classification_status
  `).all();
}
```

## Migration Script

```sql
-- migrations/002_photo_classifications.sql

-- Create main table
CREATE TABLE IF NOT EXISTS photo_classifications (
    photo_id VARCHAR PRIMARY KEY NOT NULL,
    content_tags TEXT NOT NULL,
    people_tags TEXT NOT NULL,
    mood_tags TEXT NOT NULL,
    color_tags TEXT NOT NULL,
    quality_tags TEXT NOT NULL,
    all_tags_searchable TEXT NOT NULL,
    classification_status VARCHAR NOT NULL DEFAULT 'pending',
    confidence_score REAL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_ts INTEGER,
    completed_ts INTEGER,
    error_message TEXT,
    FOREIGN KEY (photo_id) REFERENCES photos(photo_id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_classification_status 
    ON photo_classifications(classification_status);

CREATE INDEX IF NOT EXISTS idx_classification_completed 
    ON photo_classifications(completed_ts) 
    WHERE completed_ts IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classification_pending 
    ON photo_classifications(classification_status, retry_count) 
    WHERE classification_status = 'pending' OR classification_status = 'failed';

-- Create FTS virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS photo_classifications_fts USING fts5(
    photo_id UNINDEXED,
    all_tags,
    content='photo_classifications',
    content_rowid='rowid'
);

-- Create triggers
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

## Performance Considerations

### Storage Estimates
- JSON arrays: ~50-200 bytes per photo
- Searchable text: ~100-300 bytes per photo
- Metadata: ~50 bytes per photo
- **Total per photo**: ~200-550 bytes

For 10,000 photos: ~2-5 MB

### Query Performance
- **LIKE queries**: Fast with proper indexes and denormalized field
- **FTS5 queries**: Very fast for complex search patterns
- **JSON extraction**: Slower, use only when needed

### Index Maintenance
- FTS indexes updated automatically via triggers
- No manual maintenance required
- Slight overhead on INSERT/UPDATE operations

## Future Enhancements

1. **Tag Analytics Table**: Track tag frequency and usage
2. **Tag Synonyms**: Map similar tags (e.g., "ocean" ↔ "sea")
3. **Tag Hierarchy**: Parent-child relationships (e.g., "nature" → "mountains")
4. **User Preferences**: Store user tag preferences for personalization
5. **Classification History**: Track changes in classifications over time
