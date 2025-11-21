# System Patterns

## Architecture Overview

This is a serverless cron worker built on Cloudflare Workers platform. It follows the scheduled worker pattern with minimal complexity - a single TypeScript file containing the cron logic.

### Component Structure
```
beautiful-photos-worker-cron/
├── src/
│   └── index.ts          # Main worker with scheduled & fetch handlers
├── test/
│   └── index.spec.ts     # Unit tests
├── wrangler.jsonc        # Cloudflare Worker configuration
└── memory-bank/          # Project documentation
```

## Key Technical Decisions

### Cloudflare Workers Platform
- **Why**: Native cron support, global edge deployment, tight D1 database integration
- **Benefits**: No server management, automatic scaling, low latency
- **Trade-offs**: Platform-specific code, cannot run outside Cloudflare ecosystem

### D1 Database Binding
- **Pattern**: Direct database binding via `env.DB`
- **Why**: Most efficient way to access Cloudflare D1, no additional connection overhead
- **Implementation**: Database bound in wrangler.jsonc, accessed via environment

### TypeScript
- **Why**: Type safety, better IDE support, catches errors at compile time
- **Configuration**: Standard tsconfig.json with ES2021 target
- **Workers Types**: Uses `@cloudflare/workers-types` for platform APIs

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
- No return value needed (fire-and-forget pattern)

### Fetch Handler Pattern
```typescript
async function fetch(request: Request, env: Env, ctx: ExecutionContext)
```
- Required by Cloudflare Workers (even if only using cron)
- Provides manual trigger capability
- Simple health check response

### Export Pattern
```typescript
export default { scheduled, fetch };
```
- Cloudflare Workers requires default export with handler functions
- Both handlers exported even though only scheduled is actively used

### Database Query Pattern
```typescript
await env.DB.prepare(sql).bind(params).run();
```
- Prepared statement pattern prevents SQL injection
- Parameter binding for safe value insertion
- `.run()` for queries that don't return data

### Timestamp Calculation
```typescript
const now = Math.round(new Date().getTime() / 1000);
const expireTime = now - 60 * 20;
```
- Unix timestamp in seconds (D1 stores as integer)
- Manual calculation for expiration window
- Clear arithmetic for 20-minute offset

## Design Principles

### Simplicity First
- Single-purpose worker with minimal code
- No external dependencies beyond Cloudflare platform
- Direct database access without ORM layer

### Idempotency
- Running multiple times has same effect as running once
- DELETE query is naturally idempotent
- Safe to retry on failure

### Observability
- Console logging for monitoring
- Cloudflare observability enabled in wrangler.jsonc
- Simple success logging: "cron processed"

### Smart Placement
- Enabled in configuration for optimal routing
- Cloudflare automatically places worker near data
- Reduces latency for database operations

## Critical Implementation Paths

### Cron Execution Flow
1. Cloudflare scheduler invokes `scheduled()` function
2. Calculate current Unix timestamp in seconds
3. Calculate expiration threshold (now - 1200 seconds)
4. Prepare DELETE statement with bound parameter
5. Execute query against D1 database
6. Log completion
7. Function exits (no explicit response needed)

### Error Handling Strategy
- Currently minimal - relies on Cloudflare's retry mechanism
- Failed executions will be retried automatically by platform
- Logs capture any errors for debugging

## Database Schema

Complete schema is defined in `src/migrations/init.sql` (copied from Beautiful Photos Worker).

### Tables

**photos**
- `photo_id` (varchar, PRIMARY KEY) - Unique photo identifier
- `data_json` (text) - JSON data for photo
- `created_ts` (integer) - Unix timestamp in seconds

**access_tokens**
- `token` (varchar, PRIMARY KEY) - Access token string
- `created_ts` (integer) - Unix timestamp in seconds

**rate_limits**
- `ip` (TEXT) - Client IP address
- `user_id` (TEXT) - User identifier
- `endpoint` (TEXT) - API endpoint
- `count` (INTEGER, default 0) - Number of requests
- `reset_time` (INTEGER) - When counter resets (Unix timestamp)
- PRIMARY KEY: (ip, endpoint)
- Indexes:
  - `idx_rate_limits_reset_time` on `reset_time`
  - `idx_rate_limits_ip_reset_time` on `(ip, reset_time)`

## Performance Considerations

- Query runs on Cloudflare's edge network
- D1 database optimized for edge deployment
- Deletion query is lightweight (indexed timestamp column assumed)
- No pagination needed (delete all matching records in one query)
