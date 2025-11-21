# Active Context

## Current State (As of 2025-11-21)

The project is **fully functional and deployed**. The Memory Bank has just been initialized to document the existing working system.

## Recent Work

### Memory Bank Initialization
- Created complete Memory Bank structure with all core files
- Documented existing codebase and architecture
- Established foundation for future development tracking

### Database Schema Documentation
- Added `src/migrations/init.sql` with complete D1 schema (copied from main worker)
- Updated Memory Bank with full database structure documentation
- Documented all three tables: photos, access_tokens, rate_limits

## Current Focus

**Status**: Maintenance mode - system is operational and requires no immediate changes.

## Next Steps

No immediate development work required. Future tasks might include:

1. **Monitoring**: Track cron execution logs in Cloudflare dashboard
2. **Performance**: Monitor database cleanup effectiveness
3. **Enhancement**: Consider adding metrics or alerting if needed
4. **Testing**: Expand test coverage if functionality changes

## Active Decisions & Considerations

### Token Retention Period (20 minutes)
- **Current**: Hardcoded as 20 minutes
- **Consideration**: Could be made configurable via environment variable
- **Decision**: Keep hardcoded for simplicity unless business requirements change

### Cron Frequency (Every 5 minutes)
- **Current**: Runs every 5 minutes
- **Consideration**: Could adjust based on token creation rate
- **Decision**: Current frequency is adequate for expected load

### Error Handling
- **Current**: Minimal error handling, relies on Cloudflare retry mechanism
- **Consideration**: Could add explicit try-catch and error logging
- **Decision**: Current approach sufficient for simple deletion operation

### Logging Detail
- **Current**: Simple "cron processed" message
- **Consideration**: Could log number of deleted rows
- **Decision**: Keep minimal unless debugging needs arise

## Important Patterns & Preferences

### Code Style
- Clean, minimal TypeScript
- No external dependencies
- Prepared statements for SQL safety
- Clear variable names (expireTime, not et)

### Documentation
- README in Russian (project language)
- Technical docs in English (Memory Bank)
- Comments only where needed (code is self-documenting)

### Git Workflow
- Bitbucket repository
- Manual CI/CD
- bitbucket-pipelines.yml is used only for copying to GitHub repository
- Standard commit practices

## Project Insights

### Architectural Lessons
1. **Simplicity Works**: Single-file worker is easy to understand and maintain
2. **Platform Integration**: Direct D1 binding is more efficient than external connections
3. **Serverless Benefits**: No infrastructure management, automatic scaling

### What Works Well
- Scheduled execution is reliable
- D1 database binding is performant
- Smart Placement reduces latency
- TypeScript catches errors early

### Known Limitations
- Platform-locked to Cloudflare Workers
- Cannot run without Wrangler locally
- Database schema changes require coordination with main worker
- Cron schedule changes require redeployment

## Integration Notes

### With Main Beautiful Photos Worker
- Shares the same D1 database (unsplash_photos)
- Complements main worker by handling cleanup
- Independent deployment and operation
- No direct code dependencies

### Database Coordination
- Both workers must agree on `created_ts` column format (Unix timestamp)
- Schema changes in main worker must not break cleanup query
- Consider database migration coordination if schema evolves

## Development Environment

### Local Setup
- Wrangler provides local D1 emulation
- Can test cron via manual trigger or Wrangler scheduler
- No environment variables currently needed

### Deployment
- Single command deployment: `npm run deploy`
- Automatic via bitbucket-pipelines.yml
- Zero-downtime updates

## Communication Preferences

- Technical discussion in English
- User-facing content in Russian
- Clear, concise commit messages
- Memory Bank updates when significant changes occur
