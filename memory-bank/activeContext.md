# Active Context

## Current State (As of 2025-11-26)

The project has **successfully implemented photo classification feature** (Phases 1-6 completed). The worker now performs two main functions: automated photo classification using LLM and database maintenance.

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

**Status**: Testing and Monitoring Phase (Phases 7-9)

### Immediate Priorities
1. **Functional Testing**: Verify classification works end-to-end
2. **Performance Monitoring**: Track CPU usage, API costs, success rates
3. **Quality Validation**: Sample-check classification accuracy
4. **Cost Monitoring**: Ensure <10% paid model usage

### Next Testing Tasks
- Test `/classify-photos` endpoint (batch processing)
- Test `/test-classify?photo_id=X` endpoint (single photo with HTML)
- Query `/stats` endpoint for metrics
- Monitor Cloudflare Worker logs
- Check classification_logs table for model fallback frequency
- Validate tag quality and distributions

## Next Steps

### Phase 7: Testing (Current)
- [ ] Run functional tests on all endpoints
- [ ] Test with diverse photo types (nature, urban, people, etc.)
- [ ] Verify free model works (most cases)
- [ ] Verify fallback to paid model works
- [ ] Check database tables populated correctly
- [ ] Validate FTS5 search functionality

### Phase 8: Deployment (If Not Already)
- [ ] Verify migrations applied to production
- [ ] Confirm OPENROUTER_API_KEY set in production
- [ ] Deploy worker to production
- [ ] Monitor initial execution logs

### Phase 9: Monitoring & Validation
- [ ] Monitor classification success rate (target >80%)
- [ ] Check average confidence scores (target >0.7)
- [ ] Track model usage (free vs paid ratio)
- [ ] Validate tag distributions make sense
- [ ] Check for errors in logs

### Phase 10-11: Optimization & Documentation (Future)
- Optimize batch size if needed
- Adjust retry logic based on data
- Update README with new features
- Document learnings

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
- **Status**: Testing with 5, may optimize later

### Logging Strategy
- **Initial**: Considered full database logging
- **Decision**: Hybrid (console + DB for critical only)
- **Rationale**: Balance observability with database bloat
- **Status**: Implemented, 60-day log retention

## Testing Checklist (In Progress)

### Endpoint Testing
- [ ] `/classify-photos` - batch classification
- [ ] `/test-classify?photo_id=X` - single photo test
- [ ] `/stats` - statistics retrieval
- [ ] `/` - health check

### Scenario Testing
- [ ] Photos without people
- [ ] Photos with close people (portraits)
- [ ] Photos with distant people
- [ ] Various content types (nature, urban, architecture)
- [ ] Different moods and colors
- [ ] Edge cases (dark, blurry photos)

### System Testing
- [ ] Free model success
- [ ] Paid model fallback
- [ ] Database persistence
- [ ] FTS5 search functionality
- [ ] Tag normalization
- [ ] Error handling
- [ ] Retry logic

### Performance Testing
- [ ] CPU time per batch
- [ ] API response times
- [ ] Database query performance
- [ ] Memory usage
- [ ] Cron execution reliability
