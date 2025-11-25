# System Patterns

## Architecture Overview

This is a serverless cron worker built on Cloudflare Workers platform. It evolved from a simple single-file cleanup worker into a modular system with photo classification capabilities using LLM integration.

### Component Structure
```
beautiful-photos-worker-cron/
├── src/
│   ├── index.ts              # Main worker (cron + HTTP handlers)
│   ├── api/
│   │   └── openrouter-client.ts    # OpenRouter API integration
│   ├── classifiers/
│   │   └── photo-classifier.ts     # Photo classification logic
│   ├── db/
│   │   └── classification-queries.ts  # Database operations
│   ├── handlers/
│   │   └── test-classify.ts        # Test endpoint with HTML UI
│   ├── helpers/
│   │   ├── photo-url.ts           # URL generation utilities
│   │   └── types.ts               # TypeScript type definitions
│   ├── prompts/
│   │   └── classification-prompt.ts  # LLM prompts
│   ├── utils/
│   │   └── logger.ts              # Structured logging
│   └── migrations/
│       ├── 20241125000000_init.sql
│       ├── 20241125010000_photo_classifications.sql
│       └── 20241125020000_fix_fts_table.sql
├── test/
│   └── index.spec.ts         # Unit tests
├── wrangler.jsonc            # Cloudflare Worker configuration
└── memory-bank/              # Project documentation
```

## Key Technical Decisions

### Cloudflare Workers Platform
- **Why**: Native cron support, global edge deployment, tight D1 database integration, cost-effective scaling
- **Benefits**: No server management, automatic scaling, low latency, generous free tier
- **Trade-offs**: Platform-specific code, 10ms CPU time limit per execution (network I/O excluded)

### Modular Architecture
- **Pattern**: Separation of concerns with dedicated modules for API, database, classification, handlers
- **Why**: Maintainability, testability, clear responsibilities, easier debugging
- **Benefits**: Can test components in isolation, easier to understand and modify

### D1 Database Binding
- **Pattern**: Direct database binding via `env.DB`
- **Why**: Most efficient way to access Cloudflare D1, no additional connection overhead
- **Implementation**: Database bound in wrangler.jsonc, accessed via environment

### TypeScript
- **Why**: Type safety, better IDE support, catches errors at compile time
- **Configuration**: Standard tsconfig.json with ES2021 target
- **Workers Types**: Uses `@cloudflare/workers-types` for platform APIs

### OpenRouter Integration
- **Pattern**: API client with automatic fallback (free → paid model)
- **Why**: Access to Gemma 3 27B with free tier, reliable fallback for errors
- **Implementation**: Single client module handling both models, logs fallback events

## Implementation Patterns

### Scheduled Handler Pattern
```typescript
async function scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
)
```
- Entry point for cron execution
- Receives controller, environment bindings, and execution context
- Switches behavior based on `controller.cron` schedule
- Two schedules: `*/5 * * * *` (cleanup) and `* * * * *` (classification)

### Fetch Handler Pattern
```typescript
async function fetch(request: Request, env: Env, ctx: ExecutionContext)
```
- Provides HTTP endpoints for manual triggers and testing
- Routes:
  - `/classify-photos` - Manual batch classification trigger
  - `/test-classify?photo_id=X` - Single photo test with HTML interface
  - `/stats` - Classification statistics
  - `/` - Health check

### Export Pattern
```typescript
export default { scheduled, fetch };
```
- Cloudflare Workers requires default export with handler functions
- Both handlers exported and actively used

### Database Query Pattern
```typescript
await env.DB.prepare(sql).bind(params).run();
```
- Prepared statement pattern prevents SQL injection
- Parameter binding for safe value insertion
- `.run()` for mutations, `.first()` for single row, `.all()` for multiple rows

### Photo Classification Pattern
```typescript
async function classifyPhotos(env: Env, limit: number = 5)
```
1. Query unclassified photos with status locking
2. Generate optimized photo URLs
3. Call OpenRouter API (free tier first)
4. On error, automatically fallback to paid tier
5. Parse structured JSON response
6. Normalize tags into 3 tables
7. Update FTS5 index via triggers
8. Update status and log results

### Automatic Fallback Pattern
```typescript
try {
  return await callOpenRouterAPI(photoUrl, apiKey, 'google/gemma-3-27b-it:free');
} catch (error) {
  await logger.warn('Falling back to paid model', { photo_id, error });
  return await callOpenRouterAPI(photoUrl, apiKey, 'google/gemma-3-27b-it');
}
```
- Try free tier first
- On ANY error, log fallback and use paid tier
- Maximizes free tier usage while ensuring reliability

### Tag Normalization Pattern
```typescript
// For each tag:
1. INSERT OR IGNORE into tags table (creates if new)
2. UPDATE usage_count if tag exists
3. Get tag_id
4. INSERT into photo_tags relationship table
5. Build all_tags_searchable string
6. FTS5 triggers update search index automatically
```

### Timestamp Calculation
```typescript
const now = Math.round(new Date().getTime() / 1000);
const expireTime = now - 60 * 20; // 20 minutes ago
```
- Unix timestamp in seconds (D1 stores as integer)
- Manual calculation for expiration windows
- Clear arithmetic for time offsets

## Design Principles

### Simplicity First
- Clear separation of concerns
- No unnecessary abstractions
- Direct database access without ORM layer
- Minimal dependencies

### Idempotency
- Running multiple times has same effect as running once
- DELETE queries are naturally idempotent
- Classification uses status locking to prevent concurrent processing
- Safe to retry on failure

### Observability
- Structured logging with WorkerLogger class
- Console logs for debugging/development
- Database logs for critical events (errors, model fallbacks)
- Statistics endpoint for monitoring

### Smart Placement
- Enabled in configuration for optimal routing
- Cloudflare automatically places worker near D1 database
- Reduces latency for database operations

### Cost Optimization
- Free tier LLM model by default
- Automatic fallback only when needed
- Batch processing (5 photos per minute)
- Efficient database queries with proper indexes

## Critical Implementation Paths

### Photo Classification Flow
1. Cron triggers `scheduled()` every minute
2. Query 5 unclassified photos, immediately mark as 'processing'
3. Generate photo URLs (600px, quality 80)
4. Call OpenRouter API with structured prompt
5. Parse JSON response with 5 tag categories
6. Begin database transaction:
   - Update photo_classifications table with all_tags_searchable
   - For each tag: normalize into tags table, link in photo_tags
   - FTS5 triggers automatically sync search index
7. Mark status as 'completed' or 'failed'
8. Log critical events (errors, fallbacks)

### Cleanup Flow
1. Cron triggers `scheduled()` every 5 minutes
2. Calculate expiration timestamps
3. DELETE expired access tokens (>20 min old)
4. DELETE old classification logs (>60 days old)
5. Log completion

### Error Handling Strategy
- Classification errors trigger automatic fallback to paid model
- Failed classifications retry up to 3 times
- 'Processing' status older than 5 minutes gets reset
- Database errors logged for investigation
- Cloudflare's retry mechanism handles platform failures

## Database Schema

### Normalized Classification Schema

**Architecture:**
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

**Benefits:**
- ✅ Tag normalization and reusability
- ✅ Usage statistics tracking
- ✅ Fast search via denormalized field + FTS5
- ✅ Referential integrity
- ✅ Easy tag analytics and management

### Complete Table Definitions

**photos** (existing)
- `photo_id` (varchar, PRIMARY KEY)
- `data_json` (text) - JSON with Unsplash metadata
- `created_ts` (integer)

**photo_classifications** (new)
- `photo_id` (varchar, PRIMARY KEY, FK to photos)
- `all_tags_searchable` (text) - space-separated tags for search
- `classification_status` (varchar) - pending/processing/completed/failed
- `confidence_score` (real)
- `retry_count` (integer, default 0)
- `last_attempt_ts` (integer)
- `completed_ts` (integer)
- `error_message` (text)

**tags** (new)
- `tag_id` (integer, PRIMARY KEY AUTOINCREMENT)
- `tag_name` (varchar, UNIQUE)
- `tag_category` (varchar) - content/people/mood/color/quality
- `usage_count` (integer, default 0)
- `created_ts` (integer)

**photo_tags** (new)
- `photo_id` (varchar, FK)
- `tag_id` (integer, FK)
- PRIMARY KEY (photo_id, tag_id)

**classification_logs** (new)
- `id` (integer, PRIMARY KEY AUTOINCREMENT)
- `timestamp` (integer)
- `photo_id` (varchar)
- `event_type` (varchar) - attempt/success/error/model_fallback
- `model_used` (varchar) - free/paid
- `error_message` (text)
- `processing_time_ms` (integer)
- `confidence_score` (real)

**photo_classifications_fts** (FTS5 virtual table)
- `photo_id` (UNINDEXED)
- `all_tags` - full-text indexed
- Automatically synced via triggers

**access_tokens** (existing)
- `token` (varchar, PRIMARY KEY)
- `created_ts` (integer)

**rate_limits** (existing)
- `ip` (TEXT)
- `user_id` (TEXT)
- `endpoint` (TEXT)
- `count` (INTEGER, default 0)
- `reset_time` (INTEGER)
- PRIMARY KEY (ip, endpoint)

### Indexes

Classification performance optimized with:
- `idx_classification_status` - Find pending/failed photos
- `idx_classification_pending` - Partial index for queue queries
- `idx_tags_category` - Group tags by category
- `idx_tags_usage` - Most popular tags
- `idx_photo_tags_tag` - Reverse lookup (photos using a tag)
- FTS5 tokenization for natural language search

## Performance Considerations

### CPU Time Budget
- Cloudflare Workers: 10ms CPU time limit
- Network I/O (API calls) doesn't count toward CPU time
- Expected CPU usage per batch: 2-3ms
- Headroom for future optimizations

### Network Time
- OpenRouter API calls: 2-5 seconds (not counted in CPU)
- Database queries: <1ms each (edge-optimized)
- Total execution time: 3-6 seconds per batch

### Database Optimization
- Proper indexes on frequently queried columns
- Prepared statements prevent SQL injection
- Batch operations where possible
- FTS5 for efficient full-text search
- Denormalized all_tags_searchable for fast filtering

### API Cost Optimization
- Free tier model used by default (>90% expected)
- Paid fallback only on errors (<10% expected)
- 5 photos per minute = 7,200 photos/day
- Monitoring via classification_logs table

## Testing Strategy

### Unit Tests
- Test URL generation logic
- Test response parsing
- Mock OpenRouter API responses
- Test database query construction

### Integration Tests
- Full classification flow with test database
- Error handling and retry logic
- Fallback mechanism verification

### Manual Testing
- `/test-classify?photo_id=X` endpoint with HTML interface
- Shows photo, classification results, model used
- Verifies full flow including database persistence
