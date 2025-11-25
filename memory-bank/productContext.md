# Product Context

## Why This Exists

This worker serves two critical functions for the Beautiful Photos system:

### 1. Photo Classification (Primary Function)

The Beautiful Photos Extension displays photos from Unsplash, but users need better ways to discover and filter photos. This worker:

**Enables Advanced Filtering**: Users can filter photos by content type (nature, urban, architecture), mood (peaceful, energetic, dramatic), colors (warm, cool, vibrant), quality (professional, sharp), and people presence (no people, distant people, close people).

**Improves User Experience**: Users can find photos matching their preferences, such as "nature photos with warm colors, no people, professional quality."

**Supports Future Features**: Builds a rich metadata layer enabling natural language search, similar photo recommendations, and personalized experiences.

**Business Value**: 
- Increases user engagement through better discovery
- Differentiates from standard Unsplash browsing
- Enables premium features based on classifications
- Provides data for analytics and insights

### 2. Database Maintenance

The system uses access tokens for authentication and classification logs for monitoring. These need cleanup to:
- Maintain database performance
- Optimize storage costs
- Remove security risks from old tokens

## Problems It Solves

### Photo Classification Problems

**Limited Photo Discovery**: Unsplash provides basic search, but users can't filter by nuanced criteria like "nature without people" or "warm professional photography."

**Manual Tagging is Impossible**: With thousands of photos, manual classification is not scalable or cost-effective.

**Inconsistent Metadata**: Unsplash photos have varying quality of tags and descriptions, making reliable filtering difficult.

**User Frustration**: Users waste time browsing photos that don't match their preferences (e.g., they want landscapes but keep seeing photos with people).

### Database Maintenance Problems

**Token Accumulation**: Without automation, expired tokens would accumulate, requiring manual intervention.

**Performance Degradation**: Growing tables degrade query performance, affecting the main Beautiful Photos Worker.

**Log Storage Costs**: Classification logs grow continuously and need periodic cleanup.

**Resource Optimization**: Automatically removing expired data keeps the database lean and efficient.

## How It Works

### Photo Classification Flow (User Experience)

From the user's perspective:
1. User opens Beautiful Photos Extension
2. Extension shows photos with rich filtering options (content, mood, colors, etc.)
3. User applies filters: "Nature, peaceful mood, no people, blue tones"
4. Extension queries classifications and shows matching photos
5. User sees exactly what they're looking for

**Behind the scenes**:
- Worker runs every minute, processing 5 photos
- Each photo is analyzed by Gemma 3 27B LLM via OpenRouter
- AI generates structured tags across 5 categories
- Tags are normalized and stored with FTS5 search support
- Free model used by default, automatic fallback to paid if needed
- Process continues until all photos are classified

### Technical Flows

#### Photo Classification (Every Minute)
1. Query 5 unclassified photos (status = pending/failed with retry < 3)
2. Mark as 'processing' to prevent concurrent processing
3. Generate photo URLs from raw_path (600px width, optimized)
4. Call OpenRouter API with Gemma 3 27B (free tier)
5. If error, automatically fallback to paid tier (logged to DB)
6. Parse JSON response with tags by category
7. Normalize tags into 3 tables: photo_classifications, tags, photo_tags
8. Update FTS5 search index automatically via triggers
9. Mark as 'completed' or 'failed' with error details

#### Database Cleanup (Every 5 Minutes)
1. Calculate cutoff timestamps
2. Delete access tokens older than 20 minutes
3. Delete classification logs older than 60 days
4. Log completion

### Data Lifecycle

#### Photo Classification Lifecycle
- **Discovery**: Photos added to database by main Beautiful Photos Worker
- **Pending**: Initially status is NULL (unclassified)
- **Processing**: Worker locks photo during classification
- **Completed**: Successfully classified with tags and confidence score
- **Failed**: After 3 retry attempts, marked as failed (requires investigation)
- **Re-classification**: Can be manually triggered via test endpoint

#### Token Lifecycle
- **Creation**: Tokens created by main Beautiful Photos Worker during authentication
- **Active Period**: Valid for their intended use (details in main worker)
- **Expiration**: After 20 minutes considered expired
- **Cleanup**: Removed every 5 minutes

## Design Decisions

### Photo Classification Decisions

#### LLM Model Choice: Gemma 3 27B via OpenRouter
**Why**: Free tier available, good balance of quality and cost, 27B parameters provide sufficient accuracy for image classification.

#### Automatic Fallback Strategy (Free → Paid)
**Why**: Maximize use of free tier (>90% expected) while ensuring reliability. Any error triggers fallback to paid tier, logged for cost monitoring.

#### Batch Size: 5 Photos Per Minute
**Why**: Balances throughput with Cloudflare Workers CPU time limits (10ms). Network I/O (API calls) doesn't count toward CPU time.

#### Normalized Database Schema
**Why**: Tag reusability, usage statistics, referential integrity, and easy analytics. Denormalized search field (all_tags_searchable) + FTS5 provides fast search without sacrificing normalization benefits.

#### 5 Tag Categories
**Why**: Provides comprehensive filtering while remaining manageable. Categories (content, people, mood, color, quality) cover all major user filtering needs.

#### FTS5 Full-Text Search
**Why**: Enables fast natural language search queries, supports future features like "find peaceful nature photos with blue tones."

#### Retry Limit: 3 Attempts
**Why**: Gives transient errors time to resolve without infinite retries. After 3 failures, requires manual investigation.

### Database Maintenance Decisions

#### 20-Minute Token Retention
**Why**: Active sessions have sufficient time to complete, adequate buffer for clock skew between systems.

#### 60-Day Log Retention
**Why**: Balances forensic needs (can investigate issues from past 2 months) with storage optimization.

#### 5-Minute Cleanup Interval
**Why**: Timely cleanup without excessive compute, balances resource efficiency with database cleanliness.

### Technical Decisions

#### Multiple HTTP Endpoints
**Why**: `/classify-photos` for manual batch trigger, `/test-classify` for single-photo testing with visual HTML output, `/stats` for monitoring.

#### Hybrid Logging (Console + Database)
**Why**: Console for debugging/development, database for critical events (errors, model fallbacks) that need long-term tracking and analysis.
