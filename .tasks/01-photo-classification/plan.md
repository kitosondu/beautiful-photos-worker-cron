# Photo Classification Feature - Project Plan

## Overview

This document outlines the plan for implementing automatic photo classification using LLM-based analysis. The system will process photos from the `photos` table, analyze them using Gemma 3 27B via OpenRouter API, and generate structured tags across multiple categories.

## Business Goals

### Primary Objectives
1. **Enable Advanced Filtering**: Allow users to filter photos in Beautiful Photos Extension based on content, mood, colors, quality, and people presence
2. **Improve User Experience**: Help users find photos matching their preferences (e.g., "no people close to camera")
3. **Natural Language Search**: Support future natural language queries like "show nature with warm colors, no people, professional photography"
4. **Data Enrichment**: Build a rich metadata layer on top of Unsplash photos for enhanced functionality

### Success Metrics
- All photos in database successfully classified
- Classification accuracy validated through sampling
- Extension filtering works seamlessly
- Low error rate in classification process
- Minimal impact on worker CPU time limits

## Technical Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers Cron                   │
│                     (Runs Every Minute)                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  1. Query Unclassified Photos (LIMIT 5)                     │
│     SELECT * FROM photos WHERE photo_id NOT IN              │
│     (SELECT photo_id FROM photo_classifications             │
│      WHERE status = 'completed')                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Generate Photo URLs from raw_path                       │
│     https://images.unsplash.com/{raw_path}?w=600&q=80       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Send Batch to OpenRouter API (Gemma 3 27B)             │
│     - Include structured prompt                             │
│     - Request JSON response with categorized tags           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Parse LLM Response                                       │
│     - Extract tags by category                              │
│     - Validate JSON structure                               │
│     - Calculate confidence scores                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Update Database                                          │
│     - Insert/Update photo_classifications table             │
│     - Set status to 'completed' or 'failed'                 │
│     - Log errors for failed classifications                 │
└─────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Cron Handler
- **Schedule**: Every minute (`* * * * *`)
- **Function**: `scheduledClassification()`
- **Responsibility**: Orchestrate classification process

#### 2. Manual Trigger Endpoint
- **URL**: `/classify-photos`
- **Method**: GET
- **Purpose**: Allow manual triggering for testing/recovery

#### 3. Photo Classifier Module
- **File**: `src/classifiers/photo-classifier.ts`
- **Functions**:
  - `classifyPhotos(env, limit)` - Main classification logic
  - `generatePhotoUrl(rawPath)` - Convert raw_path to URL
  - `callOpenRouter(photos, apiKey)` - API integration
  - `parseClassificationResponse(response)` - Parse LLM output
  - `saveClassifications(db, classifications)` - Save to DB

#### 4. Database Layer
- **Table**: `photo_classifications` (new)
- **Relationships**: Foreign key to `photos` table
- **Indexes**: Optimized for filtering queries

## Technology Stack

### Core Technologies
- **Runtime**: Cloudflare Workers (serverless)
- **Language**: TypeScript 5.5.2
- **Database**: Cloudflare D1 (SQLite at edge)
- **LLM Provider**: OpenRouter.ai
- **LLM Model**: Google Gemma 3 27B IT

### Dependencies
- Existing project dependencies (no new production deps)
- OpenRouter API key (stored in environment variables)

## Processing Strategy

### Batch Processing
- **Batch Size**: 5 photos per cron run
- **Rationale**:
  - Cloudflare Workers free tier: 10ms CPU time limit
  - Network I/O (API calls) not counted in CPU time
  - Balance between throughput and reliability
  - Can be increased if multi-image API calls work

### Performance Considerations
- **CPU Time Budget**: ~10ms per execution
- **Network Time**: Not limited (API calls don't count)
- **Database Queries**: Optimized with indexes
- **Expected Processing Time**: 
  - DB query: <1ms
  - API call: 2-5 seconds (network time, not CPU)
  - Response parsing: <1ms
  - DB update: <1ms
  - **Total CPU**: ~2-3ms per batch

### Rate Limiting
- OpenRouter API limits apply
- Free tier considerations for Gemma 3
- Automatic retry on rate limit errors

## Classification Schema

See [categorization-schema.md](./categorization-schema.md) for detailed breakdown.

### Five Main Categories
1. **Content Tags**: What's in the photo (nature, urban, architecture, etc.)
2. **People Tags**: People presence and proximity
3. **Mood Tags**: Emotional atmosphere
4. **Color Tags**: Dominant colors and tones
5. **Quality Tags**: Technical quality indicators

### Predefined Tag Lists
- Core tags predefined for consistency
- LLM can generate new tags if needed
- Flexibility for unique characteristics

## Error Handling

### Retry Strategy
- **Max Retries**: 3 attempts
- **Retry Logic**: Simple - process on next cron run
- **Backoff**: None (cron runs every minute anyway)
- **Permanent Failure**: After 3 attempts, mark as permanently failed

### Error Types
1. **API Errors**: Network issues, rate limits, timeouts
2. **Parse Errors**: Invalid JSON from LLM
3. **Database Errors**: Constraint violations, connection issues
4. **Validation Errors**: Missing required fields in response

### Logging
- Log all classification attempts
- Log errors with full context
- Track retry counts
- Monitor success/failure rates

## Database Schema

See [database-schema.md](./database-schema.md) for detailed schema.

### Key Design Decisions (To Be Finalized)
- JSON vs separate columns for tag storage
- Normalization vs denormalization
- Index strategy for filtering
- Full-text search capabilities

## API Integration

See [api-integration.md](./api-integration.md) for implementation details.

### OpenRouter Configuration
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Model**: `google/gemma-3-27b-it`
- **Authentication**: Bearer token from `OPENROUTER_API_KEY`
- **Input**: Photo URLs + structured prompt
- **Output**: JSON with categorized tags

## Implementation Phases

### Phase 1: Setup & Infrastructure
1. Create database migration for `photo_classifications` table
2. Add OpenRouter API integration module
3. Create photo classifier module structure
4. Update worker configuration

### Phase 2: Core Classification Logic
1. Implement photo URL generation
2. Implement OpenRouter API calls
3. Implement response parsing
4. Add database operations

### Phase 3: Cron Integration
1. Add classification handler to scheduled()
2. Add manual trigger endpoint
3. Implement error handling
4. Add logging

### Phase 4: Testing & Optimization
1. Test with sample photos
2. Validate classification accuracy
3. Optimize batch size
4. Monitor performance metrics

### Phase 5: Production Deployment
1. Deploy to production
2. Monitor initial classifications
3. Adjust parameters based on results
4. Document learnings

## Configuration

### Environment Variables
```bash
# .dev.vars (local development)
OPENROUTER_API_KEY=your_api_key_here

# Production (Cloudflare secrets)
wrangler secret put OPENROUTER_API_KEY
```

### Wrangler Configuration Updates
```jsonc
{
  "name": "unsplash-for-chrome-cron",
  "triggers": {
    "crons": [
      "*/5 * * * *",  // Existing: token cleanup
      "* * * * *"      // New: photo classification
    ]
  }
}
```

## Testing Strategy

### Unit Tests
- Test URL generation logic
- Test response parsing
- Test database operations
- Mock OpenRouter API

### Integration Tests
- Test full classification flow
- Test error handling
- Test retry logic
- Validate database state

### Manual Testing
- Use `/classify-photos` endpoint
- Verify classifications in database
- Test filtering in Extension
- Validate tag quality

## Monitoring & Observability

### Metrics to Track
- Classifications per minute
- Success/failure rates
- Average processing time
- API error rates
- Retry counts
- Queue depth (unclassified photos)

### Logging
- Classification attempts
- API calls and responses
- Errors with full context
- Performance metrics

### Alerts (Future)
- High error rate
- API quota exhaustion
- Database issues
- Performance degradation

## Future Enhancements

### Short Term
1. Batch API calls (multiple images in one request)
2. Confidence score utilization
3. Re-classification of low-confidence results
4. Performance optimization

### Long Term
1. Natural language search interface
2. Similar photo recommendations
3. Custom user preferences learning
4. Advanced filtering combinations
5. Photo quality scoring
6. Duplicate detection using tags

## Related Documentation

- [categorization-schema.md](./categorization-schema.md) - Detailed tag schema
- [api-integration.md](./api-integration.md) - OpenRouter integration
- [database-schema.md](./database-schema.md) - Database design
- [implementation-checklist.md](./implementation-checklist.md) - Step-by-step guide
- [examples/prompt-example.md](./examples/prompt-example.md) - LLM prompt
- [examples/response-example.json](./examples/response-example.json) - Sample response

## Questions & Decisions Log

### Resolved
- ✅ LLM Provider: OpenRouter with Gemma 3 27B
- ✅ Classification Categories: 5 categories (content, people, mood, color, quality)
- ✅ Batch Size: Start with 5 photos
- ✅ Cron Schedule: Every minute
- ✅ Predefined Tags: Yes, with flexibility for new tags
- ✅ "Close" People Definition: Portrait, within 1-2m, or >30% of frame

### Pending
- ⏳ Database schema optimization (JSON vs columns)
- ⏳ Multi-image API batch support verification
- ⏳ Index strategy for efficient filtering
- ⏳ Confidence score usage strategy

## Project Timeline

- **Planning**: 1 session (current)
- **Database Schema Finalization**: 1 session
- **Implementation**: 2-3 sessions
- **Testing**: 1 session
- **Deployment & Monitoring**: 1 session
- **Total Estimated**: 5-7 sessions

## Contacts & Resources

- **OpenRouter Docs**: https://openrouter.ai/docs
- **Gemma 3 Model**: https://openrouter.ai/google/gemma-3-27b-it
- **Unsplash API Docs**: https://unsplash.com/documentation
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **D1 Database Docs**: https://developers.cloudflare.com/d1/
