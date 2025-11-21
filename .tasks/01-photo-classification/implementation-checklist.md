# Implementation Checklist

## Overview

This document provides a step-by-step implementation guide for the photo classification feature. Follow each phase sequentially to ensure a smooth implementation.

---

## Phase 1: Database Setup

### 1.1 Create Migration File
- [ ] Create `src/migrations/002_photo_classifications.sql`
- [ ] Copy schema from `database-schema.md` (Hybrid Approach)
- [ ] Include main table, indexes, FTS virtual table, and triggers
- [ ] Test migration locally with Wrangler

**Commands:**
```bash
# Test migration locally
wrangler d1 execute unsplash_photos --local --file=./src/migrations/002_photo_classifications.sql

# Apply to production
wrangler d1 execute unsplash_photos --file=./src/migrations/002_photo_classifications.sql
```

### 1.2 Update TypeScript Types
- [ ] Add classification types to `src/helpers/types.ts`
- [ ] Define `PhotoClassification` interface
- [ ] Define `ClassificationResult` interface
- [ ] Define `ClassificationStatus` type

**Example:**
```typescript
export interface PhotoClassification {
  photo_id: string;
  content_tags: string[];
  people_tags: string[];
  mood_tags: string[];
  color_tags: string[];
  quality_tags: string[];
  classification_status: 'pending' | 'completed' | 'failed';
  confidence_score?: number;
  retry_count: number;
  last_attempt_ts?: number;
  completed_ts?: number;
  error_message?: string;
}

export interface ClassificationResult {
  content_tags: string[];
  people_tags: string[];
  mood_tags: string[];
  color_tags: string[];
  quality_tags: string[];
  confidence_score: number;
  tokens_used?: number;
}
```

---

## Phase 2: OpenRouter API Integration

### 2.1 Create API Client Module
- [ ] Create `src/api/openrouter-client.ts`
- [ ] Implement `callOpenRouterAPI()` function
- [ ] Implement `parseClassificationResponse()` function
- [ ] Add error handling and type definitions
- [ ] Add validation for classification response

**Key Functions:**
- `callOpenRouterAPI(photoUrl: string, apiKey: string): Promise<ClassificationResult>`
- `parseClassificationResponse(response: OpenRouterResponse): ClassificationResult`
- `categorizeError(error: any): APIError`

### 2.2 Create Prompt Template
- [ ] Create `src/prompts/classification-prompt.ts`
- [ ] Copy structured prompt from `api-integration.md`
- [ ] Export as constant `CLASSIFICATION_PROMPT`
- [ ] Consider making prompt customizable if needed

### 2.3 Add URL Generation Helper
- [ ] Create `src/helpers/photo-url.ts`
- [ ] Implement `generatePhotoUrl(rawPath: string): string`
- [ ] Add parameters for width and quality optimization
- [ ] Test with actual Unsplash photo paths

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

## Phase 3: Classification Logic

### 3.1 Create Photo Classifier Module
- [ ] Create `src/classifiers/photo-classifier.ts`
- [ ] Implement main `classifyPhotos()` function
- [ ] Implement `classifySinglePhoto()` helper
- [ ] Add batch processing logic
- [ ] Implement retry mechanism

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

### 3.2 Implement Database Operations
- [ ] Create `src/db/classification-queries.ts`
- [ ] Implement `getUnclassifiedPhotos()`
- [ ] Implement `saveClassification()`
- [ ] Implement `updateClassificationError()`
- [ ] Implement `getClassificationStats()`

**Query Functions:**
```typescript
async function getUnclassifiedPhotos(
  db: D1Database,
  limit: number
): Promise<Photo[]>

async function saveClassification(
  db: D1Database,
  photoId: string,
  classification: ClassificationResult
): Promise<void>

async function updateClassificationError(
  db: D1Database,
  photoId: string,
  errorMessage: string
): Promise<void>
```

### 3.3 Add Validation Logic
- [ ] Create `src/validators/classification-validator.ts`
- [ ] Implement tag validation rules
- [ ] Check people_tags requirements
- [ ] Validate minimum tag counts
- [ ] Check confidence threshold

---

## Phase 4: Cron Integration

### 4.1 Update Main Worker File
- [ ] Modify `src/index.ts`
- [ ] Import classifier module
- [ ] Add classification logic to `scheduled()` handler
- [ ] Keep existing token cleanup logic
- [ ] Add error handling and logging

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
    await classifyPhotos(env, 5);
    
    console.log('Cron processed successfully');
  } catch (error) {
    console.error('Cron error:', error);
    throw error;
  }
}
```

### 4.2 Add Manual Trigger Endpoint
- [ ] Update `fetch()` handler in `src/index.ts`
- [ ] Add route for `/classify-photos`
- [ ] Implement manual trigger logic
- [ ] Return classification stats in response
- [ ] Add authentication if needed

**Example:**
```typescript
async function fetch(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  
  if (url.pathname === '/classify-photos') {
    try {
      const stats = await classifyPhotos(env, 10); // Process 10 photos
      return Response.json({
        success: true,
        stats
      });
    } catch (error) {
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
  }
  
  return new Response('Hello World!');
}
```

### 4.3 Update Wrangler Configuration
- [ ] Update `wrangler.jsonc`
- [ ] Add new cron schedule if different from existing
- [ ] Ensure environment variables are configured
- [ ] Test configuration syntax

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

## Phase 5: Environment Configuration

### 5.1 Update Environment Variables
- [ ] Add `OPENROUTER_API_KEY` to `.dev.vars` (already done)
- [ ] Verify API key is valid
- [ ] Test API connection

### 5.2 Configure Production Secrets
- [ ] Set production secret for `OPENROUTER_API_KEY`
```bash
wrangler secret put OPENROUTER_API_KEY
```

### 5.3 Update TypeScript Env Interface
- [ ] Update `Env` interface in `src/index.ts` or types file
```typescript
interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
}
```

---

## Phase 6: Testing

### 6.1 Unit Tests
- [ ] Create test file `test/classification.spec.ts`
- [ ] Test URL generation function
- [ ] Test response parsing logic
- [ ] Test validation functions
- [ ] Mock OpenRouter API responses

### 6.2 Integration Tests
- [ ] Test database operations locally
- [ ] Test full classification flow with mock data
- [ ] Test error handling paths
- [ ] Test retry logic

### 6.3 Manual Testing
- [ ] Run local dev server: `npm run dev`
- [ ] Trigger manual classification: `curl http://localhost:8787/classify-photos`
- [ ] Check logs for errors
- [ ] Verify database updates
- [ ] Test with various photo types

**Test Checklist:**
- [ ] Photos without people
- [ ] Photos with close people
- [ ] Photos with distant people
- [ ] Different content types (nature, urban, etc.)
- [ ] Edge cases (blurred, dark photos, etc.)

---

## Phase 7: Deployment

### 7.1 Pre-Deployment Checks
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Code reviewed and cleaned up
- [ ] Logging is appropriate (not too verbose)
- [ ] Error handling is comprehensive

### 7.2 Deploy Database Migration
- [ ] Backup production database (if possible)
- [ ] Run migration in production
```bash
wrangler d1 execute unsplash_photos --file=./src/migrations/002_photo_classifications.sql
```
- [ ] Verify tables created successfully

### 7.3 Deploy Worker
- [ ] Deploy to production
```bash
npm run deploy
```
- [ ] Verify deployment successful
- [ ] Check worker logs in Cloudflare dashboard

### 7.4 Set Production Secrets
- [ ] Set `OPENROUTER_API_KEY` secret
```bash
wrangler secret put OPENROUTER_API_KEY
```

---

## Phase 8: Monitoring & Validation

### 8.1 Initial Monitoring
- [ ] Monitor Cloudflare Worker logs
- [ ] Check cron execution frequency
- [ ] Verify classifications are being saved
- [ ] Monitor API usage and costs
- [ ] Check for errors in logs

### 8.2 Data Validation
- [ ] Query database for classification stats
```sql
SELECT classification_status, COUNT(*) as count
FROM photo_classifications
GROUP BY classification_status;
```
- [ ] Sample check classification quality
- [ ] Verify tag distributions make sense
- [ ] Check confidence scores

### 8.3 Performance Monitoring
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

## Phase 9: Optimization (Post-Launch)

### 9.1 Batch Processing Optimization
- [ ] Test if OpenRouter supports multi-image requests
- [ ] If yes, implement batch API calls
- [ ] Adjust batch size based on performance
- [ ] Monitor cost savings

### 9.2 Performance Tuning
- [ ] Analyze slow queries
- [ ] Optimize database indexes if needed
- [ ] Adjust cron frequency based on needs
- [ ] Fine-tune confidence thresholds

### 9.3 Cost Optimization
- [ ] Monitor API costs per photo
- [ ] Optimize image sizes if costs are high
- [ ] Consider caching frequently classified patterns
- [ ] Adjust processing rate if needed

---

## Phase 10: Documentation Updates

### 10.1 Update Memory Bank
- [ ] Update `memory-bank/projectbrief.md` with new feature
- [ ] Update `memory-bank/systemPatterns.md` with architecture
- [ ] Update `memory-bank/techContext.md` with new dependencies
- [ ] Update `memory-bank/progress.md` with completion status
- [ ] Update `memory-bank/activeContext.md` with learnings

### 10.2 Update README
- [ ] Document new classification feature
- [ ] Add setup instructions
- [ ] Document manual trigger endpoint
- [ ] Add troubleshooting section

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

- **Phase 1-2**: 2-3 hours (Database + API setup)
- **Phase 3**: 3-4 hours (Classification logic)
- **Phase 4**: 1-2 hours (Cron integration)
- **Phase 5**: 30 minutes (Environment config)
- **Phase 6**: 2-3 hours (Testing)
- **Phase 7**: 1 hour (Deployment)
- **Phase 8**: 1-2 hours (Monitoring)
- **Phase 9**: Ongoing (Optimization)
- **Phase 10**: 1 hour (Documentation)

**Total Estimated Time**: 12-18 hours across 2-3 sessions

---

## Notes

- Take breaks between phases
- Commit code frequently
- Test thoroughly before deploying
- Monitor closely after deployment
- Document any issues or learnings
- Keep this checklist updated with progress
