# Project Brief

## Project Name
Beautiful Photos Worker Cron

## Core Purpose
A Cloudflare Worker scheduled job (cron) that performs database maintenance for the Beautiful Photos system by dowing the following tasks:
- cleaning up expired access tokens

## Key Requirements

### Functional Requirements
- Execute scheduled cleanup every 5 minutes
- Delete access tokens created more than 20 minutes ago
- Connect to Cloudflare D1 database named "unsplash_photos"
- Log cron execution for monitoring

### Technical Requirements
- Built on Cloudflare Workers platform
- TypeScript implementation
- Uses Cloudflare D1 database binding

### Database
- **Database Name**: unsplash_photos

## Related Systems
This worker is part of the Beautiful Photos ecosystem. See the "Beautiful Photos Worker" repository for complete database schema and photos API "Beautiful Photos Chrome Extension" for UI.

## Success Criteria
- Cron job executes reliably every 5 minutes
- Expired tokens are successfully removed from database
- No errors in execution logs
- Minimal resource consumption
