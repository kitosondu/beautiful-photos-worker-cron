# Product Context

## Why This Exists

The Beautiful Photos system uses access tokens for authentication and authorization. These tokens are temporary credentials that:
- Grant time-limited access to the system
- Need to be cleaned up after expiration to maintain database performance
- Should not persist indefinitely for security reasons

This worker exists to automate the cleanup process, ensuring the database doesn't accumulate stale tokens that could:
- Degrade database performance over time
- Increase storage costs
- Create security risks if old tokens remain in the system

## Problem It Solves

**Manual Cleanup is Impractical**: Without automation, expired tokens would accumulate, requiring manual intervention to clean up the database.

**Performance Degradation**: As the access_tokens table grows with expired entries, query performance would degrade, affecting the main Beautiful Photos Worker.

**Resource Optimization**: Automatically removing expired data keeps the database lean and efficient.

## How It Works

### User Perspective
This is a background maintenance worker - users don't interact with it directly. It operates transparently to keep the system running smoothly.

### Technical Flow
1. Cloudflare's scheduler triggers the cron job every 5 minutes
2. Worker calculates the cutoff timestamp (current time - 20 minutes)
3. Executes DELETE query on access_tokens table
4. Removes all tokens created before the cutoff time
5. Logs completion for monitoring

### Token Lifecycle
- **Creation**: Tokens are created by the main Beautiful Photos Worker when users authenticate
- **Active Period**: Tokens are valid for their intended use (details in main worker repo)
- **Expiration**: After 20 minutes, tokens are considered expired
- **Cleanup**: This cron worker removes expired tokens every 5 minutes

## Design Decisions

### 20-Minute Retention
Tokens are kept for 20 minutes to ensure:
- Active sessions have sufficient time to complete
- Short-lived tokens don't accidentally get cleaned up while in use
- Adequate buffer for any clock skew between systems

### 5-Minute Cleanup Interval
Running every 5 minutes balances:
- Timely cleanup (prevents excessive accumulation)
- Resource efficiency (not too frequent to waste compute)
- Cloudflare Workers pricing considerations

### Simple HTTP Response
The `fetch` handler returns "Hello World!" to:
- Allow manual triggering/testing via HTTP
- Provide a simple health check endpoint
- Meet Cloudflare Workers requirement for fetch handler
