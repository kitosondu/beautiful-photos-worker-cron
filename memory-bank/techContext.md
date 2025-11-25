# Technical Context

## Technology Stack

### Runtime Environment
- **Platform**: Cloudflare Workers
- **Runtime**: V8 JavaScript engine at the edge
- **Node Version**: 20.19.0 (managed via Volta)
- **Execution Model**: Serverless, event-driven

### Programming Language
- **Language**: TypeScript 5.5.2
- **Target**: ES2021
- **Type Checking**: Strict mode enabled
- **Workers Types**: @cloudflare/workers-types ^4.20250319.0

### Database
- **Type**: Cloudflare D1 (SQLite at the edge)
- **Database Name**: unsplash_photos
- **Database ID**: 8a8da5a7-f3f4-4d76-bfb3-6565e5f4c1ce
- **Binding Name**: DB
- **Access Pattern**: Direct binding via environment

### Build & Development Tools

#### Wrangler (^4.2.0)
- Cloudflare Workers CLI and deployment tool
- Configuration file: wrangler.jsonc
- Commands:
  - `npm run dev` - Local development server
  - `npm run deploy` - Deploy to Cloudflare
  - `npm run cf-typegen` - Generate TypeScript types

#### Vitest (^3.2.4)
- Testing framework
- Configuration: vitest.config.mts
- Command: `npm test`

#### npm-check-updates (^17.1.15)
- Dependency update checker
- Helps maintain current package versions

### External Services

#### OpenRouter API
- **Service**: AI model gateway (openrouter.ai)
- **Model**: Google Gemma 3 27B Instruction Tuned
- **Primary**: `google/gemma-3-27b-it:free` (free tier)
- **Fallback**: `google/gemma-3-27b-it` (paid tier)
- **Purpose**: Photo classification and tag generation
- **Authentication**: Bearer token via `OPENROUTER_API_KEY`
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`

## Development Setup

### Prerequisites
1. Node.js 20.19.0 (Volta manages this automatically)
2. npm (comes with Node.js)
3. Cloudflare account with Workers access
4. D1 database already provisioned

### Local Development
```bash
npm install          # Install dependencies
npm run dev         # Start local dev server
npm test            # Run tests
```

### Deployment
```bash
npm run deploy      # Deploy to Cloudflare Workers
```

## Configuration Files

### wrangler.jsonc
- Worker name: "unsplash-for-chrome-cron"
- Compatibility date: 2025-03-13
- Cron schedules:
  - `*/5 * * * *` - Database cleanup (every 5 minutes)
  - `* * * * *` - Photo classification (every minute)
- Smart Placement: enabled
- Observability: enabled
- D1 database binding configured

### tsconfig.json
- Target: ES2021
- Module: ES2022
- Strict type checking
- Path mapping for tests

### package.json
- Private package (not published to npm)
- Version: 0.0.0
- Minimal dependencies (only dev dependencies)

### vitest.config.mts
- Test configuration for Vitest runner
- Located in project root

## Technical Constraints

### Platform Limitations
- Must run on Cloudflare Workers (no local runtime without Wrangler)
- CPU time limits per execution
- Memory limits per worker instance
- D1 database query limits

### Cloudflare Workers Environment
- No filesystem access
- No long-running processes
- Stateless execution model
- Global deployment at Cloudflare edge

### D1 Database Specifics
- SQLite-based (subset of SQL features)
- Eventual consistency in some scenarios
- Query performance optimized for edge
- Row limits per query operation

## Development Workflow

### Typical Development Cycle
1. Make code changes in `src/index.ts`
2. Test locally with `npm run dev`
3. Run unit tests with `npm test`
4. Generate types if needed: `npm run cf-typegen`
5. Deploy to production: `npm run deploy`

### Testing Strategy
- Unit tests in `test/` directory
- Local testing via Wrangler dev server
- Production testing via scheduled execution

## Dependencies

### Production Dependencies
None - zero production dependencies (all external services accessed via HTTP)

### Development Dependencies
- `@cloudflare/workers-types` - TypeScript definitions for Cloudflare Workers
- `typescript` - TypeScript compiler
- `wrangler` - Cloudflare Workers tooling and deployment
- `vitest` - Testing framework
- `npm-check-updates` - Dependency management utility

### External API Dependencies
- **OpenRouter API**: Photo classification via Gemma 3 27B model
  - Free tier: `google/gemma-3-27b-it:free`
  - Paid tier: `google/gemma-3-27b-it` (automatic fallback)

## Environment Variables

### Development (.dev.vars)
```bash
OPENROUTER_API_KEY=your_api_key_here
ENVIRONMENT=development  # Optional, for logger verbosity
```

### Production (Secrets)
Set via Wrangler CLI:
```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put ENVIRONMENT  # Optional
```

### Environment Interface
```typescript
interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  ENVIRONMENT?: 'development' | 'production';
}
```

### Required Variables
- `DB` - Cloudflare D1 database binding (configured in wrangler.jsonc)
- `OPENROUTER_API_KEY` - API key for OpenRouter service (required for classification)

### Optional Variables
- `ENVIRONMENT` - Controls logger verbosity (development = verbose, production = minimal)

## Deployment Configuration

### Smart Placement
- Automatically routes worker execution
- Places worker near D1 database for optimal performance
- Reduces latency for both classification and cleanup operations

### Observability
- Enabled in wrangler.jsonc
- Provides metrics and logging
- Accessible via Cloudflare dashboard
- Custom logging via WorkerLogger class (console + database)

### Cron Triggers
- Managed by Cloudflare's scheduler
- Two schedules defined in wrangler.jsonc:
  1. `* * * * *` - Photo classification (every minute)
  2. `*/5 * * * *` - Database cleanup (every 5 minutes)
- Cannot be changed without redeployment

### HTTP Endpoints
- `/` - Health check response
- `/classify-photos` - Manual batch classification trigger
- `/test-classify?photo_id=X` - Single photo test with HTML interface
- `/stats` - Classification statistics JSON

## Integration Points

### Cloudflare Dashboard
- Worker logs and metrics
- D1 database management
- Cron execution history
- Error monitoring
- Real-time tail logs: `wrangler tail`

### OpenRouter Dashboard
- API usage monitoring
- Cost tracking (free vs paid tier usage)
- Rate limit information
- Model availability status

### Related Repositories
- **Main Worker**: "Beautiful Photos Worker"
  - Serves photos API
  - Populates photos table
  - Extension backend
- **Extension**: "Beautiful Photos Chrome Extension"
  - Queries classified photos
  - Filters by tags/categories
  - User interface

### Shared Resources
- D1 database: `unsplash_photos`
- Database schema coordination required
- Classification data consumed by Extension

## Version Control

### Git Repository
- Bitbucket: kitosondu/beautiful-photos-worker-cron
- Latest commit: 44adcfeec2c50d06f101815b12597d5fae71ee63
- Branch strategy: standard Git workflow

### CI/CD
- Configuration: bitbucket-pipelines.yml
- Automated deployment pipeline configured
