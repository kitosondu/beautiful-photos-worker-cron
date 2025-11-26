# Active Context

## Current State (As of 2025-11-26)

The project has **successfully deployed photo classification feature** (Phases 1-8 completed). The worker is now operational in production, performing automated photo classification using LLM and database maintenance.

## Recent Work

### Photo Classification Implementation (Nov 2025)
- ✅ Created normalized database schema with 4 new tables
- ✅ Implemented OpenRouter API integration with Gemma 3 27B
- ✅ Built automatic fallback system (free → paid model)
- ✅ Created modular architecture (api/, classifiers/, db/, handlers/, utils/, prompts/)
- ✅ Implemented FTS5 full-text search on classifications
- ✅ Added structured logging system (console + database)
- ✅ Created test endpoint with HTML interface
- ✅ Applied migrations to database
- ✅ Configured environment variables

### Architecture Evolution
- Evolved from single-file cleanup worker to modular classification system
- Added 7 new modules across 6 directories
- Implemented normalized database design with tag reusability
- Added 3 HTTP endpoints for testing and monitoring

## Current Focus

**Status**: Monitoring & Optimization Phase (Phase 9-10)

### Immediate Priorities
1. **Performance Monitoring**: Track CPU usage, API costs, success rates (Ongoing)
2. **Cost Monitoring**: Ensure <10% paid model usage (Ongoing)
3. **Quality Validation**: Validate tag distributions and accuracy (Ongoing)
4. **Data Analysis**: Query statistics and identify optimization opportunities

### Completed Recently
- ✅ Manual testing completed (all scenarios tested)
- ✅ Deployed to production successfully
- ✅ Initial monitoring verified system stability
- ✅ All endpoints tested and working
- ✅ Database tables verified and operational

## Next Steps

### Phase 9: Monitoring & Validation (Current)
- [ ] Continue monitoring classification success rate (target >80%)
- [ ] Continue checking average confidence scores (target >0.7)
- [ ] Continue tracking model usage (free vs paid ratio)
- [ ] Validate tag distributions make sense
- [ ] Check for errors in logs
- [ ] Collect data for optimization decisions

### Phase 10: Optimization (Next)
- [ ] Analyze performance data
- [ ] Optimize batch size if needed
- [ ] Adjust retry logic based on patterns
- [ ] Fine-tune confidence thresholds
- [ ] Consider cost optimization strategies

### Phase 11: Documentation (Future)
- [ ] Update README with classification features
- [ ] Document all endpoints comprehensively
- [ ] Add troubleshooting guide
- [ ] Document learnings and best practices

## Active Decisions & Considerations

### Classification Strategy
- **Current**: 5 photos per minute, every minute
- **Consideration**: May increase batch size if CPU time allows
- **Decision**: Start conservative, optimize based on real data

### Model Usage
- **Current**: Free tier by default, automatic fallback to paid
- **Target**: >90% free tier usage
- **Consideration**: Monitor fallback frequency, may need rate limiting if too high
- **Decision**: Log all fallbacks to database for cost analysis

### Error Handling
- **Current**: 3 retry attempts, then mark as failed
- **Consideration**: May need to investigate patterns in failed classifications
- **Decision**: Monitor failed_status photos, adjust strategy if needed

### Tag Quality
- **Current**: Trust LLM output, store all generated tags
- **Consideration**: May need validation rules if quality issues arise
- **Decision**: Sample-check quality, add validation only if needed

## Important Patterns & Preferences

### Code Organization
- Modular architecture with clear separation of concerns
- Each module has single responsibility
- Database logic separated from business logic
- API integration isolated in dedicated module

### Database Design
- Normalized schema for tag reusability
- Denormalized search field for performance
- FTS5 for natural language search
- Automatic triggers maintain consistency

### Error Handling & Logging
- Automatic fallback on any error (maximize reliability)
- Database logging for critical events only
- Console logging for debugging/development
- Structured JSON logging with metadata

### Testing Approach
- Test endpoint with visual HTML output
- Statistics endpoint for monitoring
- Manual trigger for testing/recovery
- Real-time logs via `wrangler tail`

### Cost Optimization
- Free tier model by default
- Paid tier only on errors
- Batch processing for efficiency
- Proper indexes for fast queries

## Project Insights

### Architectural Lessons
1. **Modular Pays Off**: Clear module boundaries make testing and debugging easier
2. **Normalized + Denormalized**: Best of both worlds - tag reusability + fast search
3. **Automatic Fallback**: Simple strategy that maximizes free tier usage
4. **FTS5 Integration**: Seamless with SQLite triggers, no manual sync needed
5. **Hybrid Logging**: Console for dev, database for production monitoring

### What Works Well
- Normalized database schema with tag statistics
- Automatic model fallback strategy
- Test endpoint with visual HTML interface
- Structured logging with WorkerLogger
- Clear separation of API, classifier, database layers

### Challenges & Solutions
- **Challenge**: Complex database operations (3 tables per classification)
  - **Solution**: Isolated in classification-queries.ts, well-tested
- **Challenge**: Cost monitoring for API usage
  - **Solution**: Log every fallback to database for analysis
- **Challenge**: Testing classifications
  - **Solution**: `/test-classify` endpoint with HTML shows results visually

### Known Limitations
- Platform-locked to Cloudflare Workers
- 10ms CPU time limit (though network I/O excluded)
- Cannot batch multiple images in single API call (Gemma 3 limitation)
- Depends on OpenRouter service availability

## Integration Notes

### With Main Beautiful Photos Worker
- Shares same D1 database (unsplash_photos)
- Consumes photos table data
- Populates photo_classifications table
- Independent deployment and operation
- No code dependencies

### With Beautiful Photos Extension
- Extension will query classifications for filtering
- FTS5 enables natural language search
- Tags provide advanced filtering capabilities
- Statistics help monitor data quality

### Database Coordination
- Schema changes must be coordinated across workers
- Migrations use timestamp naming for version control
- Classification tables isolated from main worker tables
- No foreign key constraints to main worker tables (loose coupling)

## Development Environment

### Local Testing
- Wrangler provides local D1 emulation
- Can test cron via manual `/classify-photos` trigger
- Environment variables in `.dev.vars`
- Test endpoint provides visual feedback

### Monitoring Tools
- Cloudflare Dashboard for worker metrics
- `wrangler tail` for real-time logs
- `/stats` endpoint for classification metrics
- classification_logs table for historical data
- OpenRouter dashboard for API usage

## Communication Preferences

- Technical discussion in English
- User-facing content in Russian
- Memory Bank documentation in English
- Clear commit messages describing changes
- Memory Bank updates after major features

## Current Known Issues

**None currently identified** - feature just implemented, monitoring required.

### Areas to Watch
- Model fallback frequency (should be <10%)
- Classification success rate (target >80%)
- API costs and quota usage
- CPU time per execution
- Queue depth (unclassified photos backlog)

## Evolution of Project Decisions

### Database Schema Evolution
- **Initial**: Simple single-table design considered
- **Decision**: Chose normalized schema with denormalized search
- **Rationale**: Tag reusability + statistics + fast search
- **Status**: Implemented with FTS5, working well

### Model Selection
- **Initial**: Considered multiple LLM providers
- **Decision**: OpenRouter with Gemma 3 27B (free + paid)
- **Rationale**: Free tier available, automatic fallback, good quality
- **Status**: Implemented, monitoring cost ratio

### Fallback Strategy
- **Initial**: Considered retry with same model
- **Decision**: Immediate fallback to paid tier on any error
- **Rationale**: Maximizes free tier, ensures reliability
- **Status**: Implemented with database logging

### Batch Size
- **Initial**: Considered 10 photos per minute
- **Decision**: Started with 5 photos per minute
- **Rationale**: Conservative start, can increase if CPU time allows
- **Status**: Decreased to 3 as couple times we hit CPU limit

### Logging Strategy
- **Initial**: Considered full database logging
- **Decision**: Hybrid (console + DB for critical only)
- **Rationale**: Balance observability with database bloat
- **Status**: Implemented, 60-day log retention

## Testing Checklist ✅ COMPLETED

### Endpoint Testing
- [x] `/classify-photos` - batch classification ✅
- [x] `/test-classify?photo_id=X` - single photo test ✅
- [x] `/stats` - statistics retrieval ✅
- [x] `/` - health check ✅

### Scenario Testing
- [x] Photos without people ✅
- [x] Photos with close people (portraits) ✅
- [x] Photos with distant people ✅
- [x] Various content types (nature, urban, architecture) ✅
- [x] Different moods and colors ✅
- [x] Edge cases (dark, blurry photos) ✅

### System Testing
- [x] Free model success ✅
- [x] Paid model fallback ✅
- [x] Database persistence ✅
- [x] FTS5 search functionality ✅
- [x] Tag normalization ✅
- [x] Error handling ✅
- [x] Retry logic ✅

### Performance Testing
- [x] CPU time per batch ✅
- [x] API response times ✅
- [x] Database query performance ✅
- [x] Memory usage ✅
- [x] Cron execution reliability ✅

**Note:** Automated unit/integration tests deferred for future implementation. Manual testing completed successfully.
