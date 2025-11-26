# Implementation Checklist

## Overview

This document provides a step-by-step implementation guide for the photo classification feature. Follow each phase sequentially to ensure a smooth implementation.

---

## Phase 1: Database Setup ✅ COMPLETE

### 1.1 Create Migration File
- [x] Create `src/migrations/20241125010000_photo_classifications.sql` ✅
- [x] Schema includes 4 tables: `photo_classifications`, `tags`, `photo_tags`, `classification_logs` ✅
- [x] Indexes, FTS5 virtual table, and triggers included ✅
- [x] Test migration locally with Wrangler ✅
- [x] Apply migration to database ✅

**Migration Files:**
```
src/migrations/
├── 20241125000000_init.sql                        (renamed from init.sql)
└── 20241125010000_photo_classifications.sql       (new)
```

**Commands:**
```bash
# Test migration locally
wrangler d1 execute unsplash_photos --local --file=./src/migrations/20241125010000_photo_classifications.sql

# Apply to production
wrangler d1 execute unsplash_photos --file=./src/migrations/20241125010000_photo_classifications.sql
```

**Note:** Migration files use timestamp format `YYYYMMDDHHmmss_name.sql` for versioning.
This allows copying migrations between repositories and applying in correct order.

### 1.2 Update TypeScript Types
- [x] Add classification types to `src/helpers/types.ts` ✅
- [x] Define `PhotoClassification` interface (for main table) ✅
- [x] Define `Tag` interface (for tag dictionary) ✅
- [x] Define `ClassificationResult` interface (for API result) ✅
- [x] Define `ClassificationLog` interface (for logging) ✅

**Example:**
```typescript
export interface PhotoClassification {
  photo_id: string;
  all_tags_searchable: string;
  classification_status: 'pending' | 'completed' | 'failed';
  confidence_score?: number;
  retry_count: number;
  last_attempt_ts?: number;
  completed_ts?: number;
  error_message?: string;
}

export interface Tag {
  tag_id: number;
  tag_name: string;
  tag_category: 'content' | 'people' | 'mood' | 'color' | 'quality';
  usage_count: number;
  created_ts: number;
}

export interface ClassificationResult {
  content_tags: string[];
  people_tags: string[];
  mood_tags: string[];
  color_tags: string[];
  quality_tags: string[];
  confidence_score: number;
}

export interface ClassificationLog {
  id: number;
  timestamp: number;
  photo_id: string;
  event_type: 'attempt' | 'success' | 'error' | 'model_fallback';
  model_used?: 'free' | 'paid';
  error_message?: string;
  processing_time_ms?: number;
  confidence_score?: number;
}
```

---

## Phase 2: Logging Setup ✅ COMPLETE

### 2.1 Create Logger Module
- [x] Create `src/utils/logger.ts` ✅
- [x] Implement `WorkerLogger` class with 4 levels (DEBUG, INFO, WARN, ERROR) ✅
- [x] Add structured JSON logging ✅
- [x] Implement DB logging for critical events ✅
- [x] Add error handling (logging failures shouldn't break app) ✅

**Key Methods:**
```typescript
class WorkerLogger {
  debug(message: string, meta?: LogMetadata): void
  info(message: string, meta?: LogMetadata): void
  async warn(message: string, meta?: LogMetadata): Promise<void>
  async error(message: string, error: Error, meta?: LogMetadata): Promise<void>
}
```

---

## Phase 3: OpenRouter API Integration ✅ COMPLETE

### 3.1 Create API Client Module
- [x] Create `src/api/openrouter-client.ts` ✅
- [x] Implement `callOpenRouterAPI()` function with `model` parameter ✅
- [x] Implement `classifyPhotoWithFallback()` wrapper (free → paid) ✅
- [x] Implement `parseClassificationResponse()` function ✅
- [x] Add error handling and type definitions ✅
- [x] Add validation for classification response ✅

**Key Functions:**
- `callOpenRouterAPI(photoUrl: string, apiKey: string, model: string): Promise<ClassificationResult>`
- `classifyPhotoWithFallback(photoUrl, apiKey, logger, photoId): Promise<{result, modelUsed}>`
- `parseClassificationResponse(response: OpenRouterResponse): ClassificationResult`

### 3.2 Create Prompt Template
- [x] Create `src/prompts/classification-prompt.ts` ✅
- [x] Copy structured prompt from `api-integration.md` ✅
- [x] Export as constant `CLASSIFICATION_PROMPT` ✅
- [x] Consider making prompt customizable if needed ✅

### 3.3 Add URL Generation Helper
- [x] Create `src/helpers/photo-url.ts` ✅
- [x] Implement `generatePhotoUrl(rawPath: string): string` ✅
- [x] Add parameters for width and quality optimization ✅
- [x] Test with actual Unsplash photo paths ✅

**Example:**
```typescript
export function generatePhotoUrl(
  rawPath: string,
  width: number = 600,
  quality: number = 80
): string {
  return `https://images.unsplash.com/${rawPath}?w=${width}&q=${quality}`;
}
```

---

## Phase 4: Classification Logic ✅ COMPLETE

### 4.1 Create Photo Classifier Module
- [x] Create `src/classifiers/photo-classifier.ts` ✅
- [x] Implement main `classifyPhotos()` function ✅
- [x] Implement `classifySinglePhoto()` helper ✅
- [x] Add batch processing logic ✅
- [x] Implement retry mechanism ✅

**Key Functions:**
```typescript
// Main entry point
async function classifyPhotos(
  env: Env,
  limit: number = 5
): Promise<ClassificationStats>

// Single photo classification
async function classifySinglePhoto(
  photo: Photo,
  apiKey: string
): Promise<ClassificationResult>

// Save to database
async function saveClassification(
  db: D1Database,
  photoId: string,
  classification: ClassificationResult
): Promise<void>

// Error handling
async function saveClassificationError(
  db: D1Database,
  photoId: string,
  error: string,
  retryCount: number
): Promise<void>
```

### 4.2 Implement Database Operations
- [x] Create `src/db/classification-queries.ts` ✅
- [x] Implement `getUnclassifiedPhotos()` ✅
- [x] Implement `saveClassification()` - complex! (normalizes tags into 3 tables) ✅
- [x] Implement `getPhotoById()` for test endpoint ✅
- [x] Implement `getPhotoClassification()` - retrieves with tags by category ✅
- [x] Implement `updateClassificationError()` ✅
- [x] Implement `getClassificationStats()` ✅

**Key Implementation Notes:**
`saveClassification()` must:
1. Build `all_tags_searchable` string (space-separated all tags)
2. Insert/update `photo_classifications` table
3. Delete old `photo_tags` relationships
4. For each tag: insert into `tags` (or increment usage_count), get tag_id, insert into `photo_tags`

**Query Functions:**
```typescript
async function getUnclassifiedPhotos(db: D1Database, limit: number): Promise<Photo[]>
async function saveClassification(db: D1Database, photoId: string, classification: ClassificationResult): Promise<void>
async function getPhotoById(db: D1Database, photoId: string): Promise<Photo | null>
async function getPhotoClassification(db: D1Database, photoId: string): Promise<PhotoClassification & ClassificationResult>
async function updateClassificationError(db: D1Database, photoId: string, errorMessage: string): Promise<void>
```

### 4.3 Add Validation Logic
- [x] Validation implemented in classifier and API client ✅
- [x] Tag validation in response parsing ✅
- [x] People tags validated ✅
- [x] Minimum tag counts checked ✅
- [x] Confidence threshold validated ✅

---

## Phase 5: Cron Integration ✅ COMPLETE

### 5.1 Update Main Worker File
- [x] Modify `src/index.ts` ✅
- [x] Import classifier module ✅
- [x] Add classification logic to `scheduled()` handler ✅
- [x] Keep existing token cleanup logic ✅
- [x] Add error handling and logging ✅

**Example Structure:**
```typescript
async function scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext
) {
  try {
    // Existing: Clean up expired tokens
    await cleanupExpiredTokens(env);
    
    // New: Classify photos
    await classifyPhotos(env, 3);
    
    console.log('Cron processed successfully');
  } catch (error) {
    console.error('Cron error:', error);
    throw error;
  }
}
```

### 5.2 Add Manual Trigger Endpoints

**Batch Classification Endpoint:**
- [x] Update `fetch()` handler in `src/index.ts` ✅
- [x] Add route for `/classify-photos` ✅
- [x] Implement manual trigger logic ✅
- [x] Return classification stats in response ✅

**Test Classification Endpoint:**
- [x] Create `src/handlers/test-classify.ts` ✅
- [x] Implement `handleTestClassify(request, env)` function ✅
- [x] Create `generateSuccessHTML()` function for visual results ✅
- [x] Create `generateErrorHTML()` function for errors ✅
- [x] Add route for `/test-classify` in main worker ✅
- [x] Test endpoint performs FULL classification + save to DB ✅

See [test-endpoint.md](./test-endpoint.md) for detailed implementation.

**Example Routes:**
```typescript
async function fetch(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  
  // Batch classification
  if (url.pathname === '/classify-photos') {
    const stats = await classifyPhotos(env, 3);
    return Response.json({ success: true, stats });
  }
  
  // Test single photo with HTML result
  if (url.pathname === '/test-classify') {
    return await handleTestClassify(request, env);
  }
  
  return new Response('Beautiful Photos Worker Cron');
}
```

### 5.3 Update Wrangler Configuration
- [x] Update `wrangler.jsonc` ✅
- [x] Add new cron schedule (`* * * * *`) ✅
- [x] Ensure environment variables are configured ✅
- [x] Test configuration syntax ✅

**Example:**
```jsonc
{
  "triggers": {
    "crons": [
      "*/5 * * * *",  // Existing: token cleanup every 5 minutes
      "* * * * *"     // New: photo classification every minute
    ]
  }
}
```

---

## Phase 6: Environment Configuration ✅ COMPLETE

### 6.1 Update Environment Variables
- [x] Add `OPENROUTER_API_KEY` to `.dev.vars` ✅
- [x] Verify API key is valid ✅
- [x] Test API connection ✅

### 6.2 Configure Production Secrets
- [x] Production secret ready to be set ✅
```bash
wrangler secret put OPENROUTER_API_KEY
```

### 6.3 Update TypeScript Env Interface
- [x] Update `Env` interface in `src/helpers/types.ts` ✅
```typescript
interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  ENVIRONMENT?: 'development' | 'production'; // Optional for logger
}
```

---

## Phase 7: Testing ✅ COMPLETE (except automated tests)

### 7.1 Unit Tests ⏳ DEFERRED
- [ ] Create test file `test/logger.spec.ts` for logger
- [ ] Create test file `test/classification.spec.ts`
- [ ] Test URL generation function
- [ ] Test response parsing logic
- [ ] Test validation functions
- [ ] Mock OpenRouter API responses

**Note:** Automated unit tests deferred for future implementation.

### 7.2 Integration Tests ⏳ DEFERRED
- [ ] Test database operations locally
- [ ] Test full classification flow with mock data
- [ ] Test error handling paths
- [ ] Test retry logic

**Note:** Automated integration tests deferred for future implementation.

### 7.3 Manual Testing ✅ COMPLETE

**Using Test Endpoint:**
- [x] Run local dev server: `npm run dev` ✅
- [x] Open browser: `http://localhost:8787/test-classify?photo_id=YOUR_PHOTO_ID` ✅
- [x] Verify HTML displays correctly with photo and classification ✅
- [x] Check if model used is shown (free/paid) ✅
- [x] Verify data saved to database ✅
- [x] Test with invalid photo_id (should show error page) ✅

**Using Batch Endpoint:**
- [x] Trigger manual classification: `curl http://localhost:8787/classify-photos` ✅
- [x] Check logs for errors ✅
- [x] Verify database updates ✅

**Test Checklist:**
- [x] Photos without people ✅
- [x] Photos with close people (portrait, <2m, >30% frame) ✅
- [x] Photos with distant people ✅
- [x] Different content types (nature, urban, architecture, etc.) ✅
- [x] Edge cases (blurred, dark photos, etc.) ✅
- [x] Free model works (most cases) ✅
- [x] Fallback to paid model works ✅
- [x] Logging works (check console and database) ✅

---

## Phase 8: Deployment ✅ COMPLETE

### 8.1 Pre-Deployment Checks
- [x] All tests passing (manual tests completed) ✅
- [x] No TypeScript errors ✅
- [x] Code reviewed and cleaned up ✅
- [x] Logging is appropriate (not too verbose) ✅
- [x] Error handling is comprehensive ✅

### 8.2 Deploy Database Migration
- [x] Backup production database (if possible) ✅
- [x] Run migration in production ✅
```bash
wrangler d1 execute unsplash_photos --file=./src/migrations/20241125010000_photo_classifications.sql
```
- [x] Verify tables created successfully ✅
```sql
-- Verify tables exist
SELECT name FROM sqlite_master WHERE type='table' 
AND name IN ('photo_classifications', 'tags', 'photo_tags', 'classification_logs');

-- Verify FTS5 table
SELECT name FROM sqlite_master WHERE type='table' AND name='photo_classifications_fts';
```

### 8.3 Deploy Worker
- [x] Deploy to production ✅
```bash
npm run deploy
```
- [x] Verify deployment successful ✅
- [x] Check worker logs in Cloudflare dashboard ✅

### 8.4 Set Production Secrets
- [x] Set `OPENROUTER_API_KEY` secret ✅
```bash
wrangler secret put OPENROUTER_API_KEY
```

---

## Phase 9: Monitoring & Validation 🚧 IN PROGRESS

### 9.1 Initial Monitoring
- [x] Monitor Cloudflare Worker logs (real-time via Dashboard or `wrangler tail`) ✅
- [x] Check cron execution frequency ✅
- [x] Verify classifications are being saved to all 3 tables ✅
- [ ] Monitor API usage and costs (check for paid model usage) - **Ongoing**
- [x] Check for errors in logs (both console and database) ✅
- [ ] Monitor model fallback frequency (should be <10%) - **Ongoing**

### 9.2 Data Validation
- [ ] Query database for classification stats
```sql
-- Classification status
SELECT classification_status, COUNT(*) as count
FROM photo_classifications
GROUP BY classification_status;

-- Tag statistics
SELECT tag_category, COUNT(*) as unique_tags, SUM(usage_count) as total_usage
FROM tags
GROUP BY tag_category;

-- Model usage
SELECT model_used, COUNT(*) as count
FROM classification_logs
WHERE model_used IS NOT NULL
GROUP BY model_used;
```
- [ ] Sample check classification quality using test endpoint
- [ ] Verify tag distributions make sense (top 20 tags query)
- [ ] Check confidence scores
- [ ] Verify `all_tags_searchable` field is populated correctly

### 9.3 Performance Monitoring
- [ ] Monitor worker CPU time usage
- [ ] Check average classification time
- [ ] Monitor API response times
- [ ] Track token usage and costs

**Key Metrics to Track:**
- Classifications per minute
- Success/failure rate
- Average confidence score
- CPU time per execution
- API costs
- Queue depth (unclassified photos)

---

## Phase 10: Optimization (Post-Launch)

### 10.1 Batch Processing Optimization
- [ ] Test if OpenRouter supports multi-image requests
- [ ] If yes, implement batch API calls
- [ ] Adjust batch size based on performance
- [ ] Monitor cost savings

### 10.2 Performance Tuning
- [ ] Analyze slow queries (especially normalized joins)
- [ ] Analyze slow queries
- [ ] Optimize database indexes if needed
- [ ] Adjust cron frequency based on needs
- [ ] Fine-tune confidence thresholds

### 10.3 Cost Optimization
- [ ] Monitor API costs per photo
- [ ] Track free vs paid model usage ratio
- [ ] Alert if >20% using paid model (indicates quota issues)
- [ ] Optimize image sizes if costs are high
- [ ] Consider caching frequently classified patterns
- [ ] Adjust processing rate if needed

---

## Phase 11: Documentation Updates

### 11.1 Update Memory Bank
- [ ] Update `memory-bank/projectbrief.md` with new feature
- [ ] Update `memory-bank/systemPatterns.md` with normalized DB architecture
- [ ] Update `memory-bank/techContext.md` with new dependencies
- [ ] Update `memory-bank/progress.md` with completion status
- [ ] Update `memory-bank/activeContext.md` with learnings and patterns

### 11.2 Update README
- [ ] Document new classification feature
- [ ] Add setup instructions
- [ ] Document both endpoints (`/classify-photos` and `/test-classify`)
- [ ] Add troubleshooting section
- [ ] Document model fallback strategy

---

## Rollback Plan

If issues arise in production:

### Quick Rollback Steps
1. **Disable Cron**: Comment out classification cron in `wrangler.jsonc` and redeploy
2. **Revert Deployment**: Deploy previous version
```bash
git revert HEAD
npm run deploy
```
3. **Database Cleanup**: If needed, drop classification tables
```sql
DROP TABLE IF EXISTS photo_classifications_fts;
DROP TABLE IF EXISTS photo_classifications;
```

### Partial Rollback
- Keep tables but disable cron processing
- Fix issues and redeploy
- Resume processing once stable

---

## Success Criteria

The implementation is considered successful when:

- [ ] All phases completed without critical issues
- [ ] Classification cron runs every minute successfully
- [ ] Photos are being classified with >80% success rate
- [ ] Average confidence score is >0.7
- [ ] No errors in last 24 hours of logs
- [ ] CPU time stays under 10ms per execution
- [ ] API costs are within budget
- [ ] Manual trigger endpoint works reliably
- [ ] Extension can query classifications successfully
- [ ] Team is satisfied with tag quality

---

## Timeline Estimate

- **Phase 1**: 1-2 hours (Database setup - more complex with normalized schema)
- **Phase 2**: 1 hour (Logging setup)
- **Phase 3**: 2-3 hours (API integration with fallback)
- **Phase 4**: 3-4 hours (Classification logic with complex DB operations)
- **Phase 5**: 1-2 hours (Cron integration + test endpoint)
- **Phase 6**: 30 minutes (Environment config)
- **Phase 7**: 2-3 hours (Testing - more scenarios with fallback and logging)
- **Phase 8**: 1 hour (Deployment)
- **Phase 9**: 1-2 hours (Monitoring)
- **Phase 10**: Ongoing (Optimization)
- **Phase 11**: 1 hour (Documentation)

**Total Estimated Time**: 14-20 hours across 2-3 sessions

---

## Notes

- Take breaks between phases
- Commit code frequently
- Test thoroughly before deploying
- Monitor closely after deployment
- Document any issues or learnings
- Keep this checklist updated with progress
