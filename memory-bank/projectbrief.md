# Project Brief

## Project Name
Beautiful Photos Worker Cron

## Core Purpose
A Cloudflare Worker scheduled job (cron) that performs two main functions for the Beautiful Photos system:
1. **Photo Classification**: Automatically classifies photos using LLM (Gemma 3 27B via OpenRouter) to generate structured tags across 5 categories (content, people, mood, color, quality)
2. **Database Maintenance**: Cleans up expired access tokens and old classification logs

## Key Requirements

### Functional Requirements

#### Photo Classification
- Execute photo classification every minute
- Process up to 5 unclassified photos per run
- Generate tags across 5 categories: content, people, mood, color, quality
- Use OpenRouter API with Gemma 3 27B model (free tier primary, paid fallback)
- Store classifications in normalized database schema with FTS5 search support
- Provide manual trigger endpoint (`/classify-photos`) and test interface (`/test-classify`)
- Track classification statistics via `/stats` endpoint

#### Database Maintenance
- Execute cleanup every 5 minutes
- Delete access tokens created more than 20 minutes ago
- Delete classification logs older than 60 days
- Connect to Cloudflare D1 database named "unsplash_photos"
- Log cron execution for monitoring

### Technical Requirements
- Built on Cloudflare Workers platform
- TypeScript implementation
- Uses Cloudflare D1 database binding

### Database
- **Database Name**: unsplash_photos

#### Core Tables
- `photos` - Photo metadata from Unsplash API (source data for classification)
- `access_tokens` - Temporary authentication tokens
- `rate_limits` - API rate limiting data

#### Classification Tables (New)
- `photo_classifications` - Main classification table with searchable tags and status
- `tags` - Normalized tag dictionary with categories and usage statistics
- `photo_tags` - Many-to-many relationship between photos and tags
- `classification_logs` - Audit trail for critical events (errors, model fallbacks)
- `photo_classifications_fts` - FTS5 virtual table for full-text search

## Related Systems
This worker is part of the Beautiful Photos ecosystem. See the "Beautiful Photos Worker" repository for complete database schema and photos API "Beautiful Photos Chrome Extension" for UI.

## Success Criteria

### Photo Classification
- Classification cron runs every minute successfully
- >80% success rate for photo classifications
- Average confidence score >0.7
- <10% usage of paid model (free tier should handle most)
- CPU time stays under 10ms per execution
- Extension can query and filter photos by classifications

### Database Maintenance
- Cleanup cron executes reliably every 5 minutes
- Expired tokens and old logs are successfully removed
- No errors in execution logs
- Minimal resource consumption
