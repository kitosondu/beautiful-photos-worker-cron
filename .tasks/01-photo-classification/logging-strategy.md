# Logging Strategy

## Overview

This document outlines the logging strategy for the photo classification system. We use a **hybrid approach** combining console logging for development/debugging with database logging for critical production events.

## Logging Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    All Events                                │
│              console.log / console.error                     │
│         (viewed via Cloudflare Dashboard or wrangler tail)   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                Critical Events Only                          │
│            classification_logs table (D1)                    │
│   (model fallbacks, errors, low confidence classifications)  │
└─────────────────────────────────────────────────────────────┘
```

## Log Levels

### 1. DEBUG (Console only, development only)
- Detailed execution flow
- Variable values
- Function entry/exit
- Only logged when `ENVIRONMENT === 'development'`

### 2. INFO (Console)
- Classification start
- Classification success
- API call details
- Processing metrics

### 3. WARN (Console + DB for specific cases)
- Model fallback from free to paid
- Low confidence classifications (<0.5)
- Retry attempts

### 4. ERROR (Console + DB)
- API failures
- Validation errors
- Database errors
- All classification failures

## Logger Implementation

```typescript
// src/utils/logger.ts

interface LogMetadata {
  photo_id?: string;
  model_used?: 'free' | 'paid';
  confidence?: number;
  processing_time_ms?: number;
  error?: string;
  [key: string]: any;
}

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

enum LogEvent {
  CLASSIFICATION_START = 'classification_start',
  CLASSIFICATION_SUCCESS = 'classification_success',
  CLASSIFICATION_ERROR = 'classification_error',
  MODEL_FALLBACK = 'model_fallback',
  VALIDATION_ERROR = 'validation_error',
  DB_SAVE_SUCCESS = 'db_save_success',
  DB_SAVE_ERROR = 'db_save_error',
  LOW_CONFIDENCE = 'low_confidence'
}

export class WorkerLogger {
  constructor(
    private env: Env,
    private isDevelopment: boolean = false
  ) {}

  /**
   * Debug logging (development only)
   */
  debug(message: string, meta?: LogMetadata): void {
    if (this.isDevelopment) {
      console.log(this.formatLog(LogLevel.DEBUG, message, meta));
    }
  }

  /**
   * Info logging (always to console)
   */
  info(message: string, meta?: LogMetadata): void {
    console.log(this.formatLog(LogLevel.INFO, message, meta));
  }

  /**
   * Warning logging (console + DB for critical warnings)
   */
  async warn(message: string, meta?: LogMetadata): Promise<void> {
    console.warn(this.formatLog(LogLevel.WARN, message, meta));
    
    // Log to DB if it's a critical warning
    if (this.isCriticalWarning(message, meta)) {
      await this.saveToDb(message, meta, 'warning');
    }
  }

  /**
   * Error logging (console + DB)
   */
  async error(message: string, error: Error, meta?: LogMetadata): Promise<void> {
    const errorMeta = {
      ...meta,
      error: error.message,
      stack: error.stack
    };
    
    console.error(this.formatLog(LogLevel.ERROR, message, errorMeta));
    
    // Always save errors to DB
    await this.saveToDb(message, errorMeta, 'error');
  }

  /**
   * Format log message as JSON
   */
  private formatLog(level: LogLevel, message: string, meta?: LogMetadata): string {
    return JSON.stringify({
      level,
      timestamp: new Date().toISOString(),
      message,
      ...meta
    });
  }

  /**
   * Determine if warning should be saved to DB
   */
  private isCriticalWarning(message: string, meta?: LogMetadata): boolean {
    // Model fallback
    if (message.includes('fallback') || message.includes('paid model')) {
      return true;
    }
    
    // Low confidence
    if (meta?.confidence && meta.confidence < 0.5) {
      return true;
    }
    
    return false;
  }

  /**
   * Save critical log to database
   */
  private async saveToDb(
    message: string, 
    meta: LogMetadata, 
    eventType: 'warning' | 'error'
  ): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      await this.env.DB.prepare(`
        INSERT INTO classification_logs (
          timestamp,
          photo_id,
          event_type,
          model_used,
          error_message,
          processing_time_ms,
          confidence_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        now,
        meta.photo_id || 'unknown',
        eventType === 'error' ? 'error' : 'model_fallback',
        meta.model_used || null,
        message + (meta.error ? `: ${meta.error}` : ''),
        meta.processing_time_ms || null,
        meta.confidence || null
      ).run();
    } catch (dbError) {
      // Don't throw - logging shouldn't break the application
      console.error('Failed to save log to database:', dbError);
    }
  }
}
```

## Usage Examples

### 1. Basic Classification Flow

```typescript
const logger = new WorkerLogger(env, env.ENVIRONMENT === 'development');

// Start classification
logger.info('Starting photo classification', {
  photo_id: 'abc123',
  batch_size: 5
});

// Success
logger.info('Classification completed', {
  photo_id: 'abc123',
  model_used: 'free',
  confidence: 0.95,
  processing_time_ms: 2341
});
```

### 2. Model Fallback

```typescript
try {
  // Try free model
  result = await classifyPhoto(photoUrl, 'free');
} catch (error) {
  // Log fallback to paid model (saves to DB)
  await logger.warn('Falling back to paid model', {
    photo_id,
    model_used: 'free',
    error: error.message,
    reason: 'rate_limit'
  });
  
  // Try paid model
  result = await classifyPhoto(photoUrl, 'paid');
  
  logger.info('Classification succeeded with paid model', {
    photo_id,
    model_used: 'paid',
    confidence: result.confidence_score
  });
}
```

### 3. Error Handling

```typescript
try {
  await saveClassification(db, photoId, classification);
  
  logger.info('Classification saved to database', {
    photo_id: photoId
  });
} catch (error) {
  // Logs to both console and DB
  await logger.error('Failed to save classification', error, {
    photo_id: photoId,
    confidence: classification.confidence_score
  });
  
  throw error;
}
```

### 4. Low Confidence Warning

```typescript
if (classification.confidence_score < 0.5) {
  // Logs to DB for review
  await logger.warn('Low confidence classification', {
    photo_id,
    confidence: classification.confidence_score,
    model_used: 'free'
  });
}
```

## Viewing Logs

### Console Logs (Real-time)

**Local Development:**
```bash
# Terminal 1: Run worker
npm run dev

# Terminal 2: Tail logs
wrangler tail
```

**Production:**
```bash
# Tail production logs
wrangler tail --env production

# Or view in Cloudflare Dashboard:
# Workers → beautiful-photos-worker-cron → Logs → Real-time Logs
```

### Database Logs (Historical)

```sql
-- Recent errors
SELECT * FROM classification_logs
WHERE event_type = 'error'
ORDER BY timestamp DESC
LIMIT 50;

-- Model fallbacks in last 24 hours
SELECT 
  photo_id,
  timestamp,
  error_message,
  model_used
FROM classification_logs
WHERE event_type = 'model_fallback'
  AND timestamp > (strftime('%s', 'now') - 86400)
ORDER BY timestamp DESC;

-- Low confidence classifications
SELECT 
  photo_id,
  confidence_score,
  timestamp
FROM classification_logs
WHERE event_type = 'model_fallback'
  AND confidence_score < 0.5
ORDER BY confidence_score ASC
LIMIT 20;

-- Error summary
SELECT 
  DATE(timestamp, 'unixepoch') as date,
  event_type,
  COUNT(*) as count
FROM classification_logs
GROUP BY date, event_type
ORDER BY date DESC, count DESC;
```

## Log Analysis Queries

### Performance Metrics

```sql
-- Average processing time by model
SELECT 
  model_used,
  COUNT(*) as classifications,
  AVG(processing_time_ms) as avg_time,
  MIN(processing_time_ms) as min_time,
  MAX(processing_time_ms) as max_time
FROM classification_logs
WHERE processing_time_ms IS NOT NULL
GROUP BY model_used;

-- Classifications per hour
SELECT 
  strftime('%Y-%m-%d %H:00', timestamp, 'unixepoch') as hour,
  COUNT(*) as count
FROM classification_logs
WHERE event_type IN ('success', 'error')
GROUP BY hour
ORDER BY hour DESC
LIMIT 24;
```

### Error Analysis

```sql
-- Most common errors
SELECT 
  SUBSTR(error_message, 1, 100) as error_preview,
  COUNT(*) as occurrences
FROM classification_logs
WHERE event_type = 'error'
GROUP BY error_preview
ORDER BY occurrences DESC
LIMIT 10;

-- Photos with repeated failures
SELECT 
  photo_id,
  COUNT(*) as failure_count,
  MAX(timestamp) as last_failure
FROM classification_logs
WHERE event_type = 'error'
GROUP BY photo_id
HAVING failure_count > 1
ORDER BY failure_count DESC;
```

## Log Retention

### Console Logs
- **Cloudflare Dashboard**: Last ~1-2 hours
- **wrangler tail**: Real-time only (no retention)

### Database Logs
- **Retention**: Indefinite (until manually cleaned up)
- **Cleanup Strategy**: Archive or delete logs older than 90 days

```sql
-- Cleanup old logs (keep last 90 days)
DELETE FROM classification_logs
WHERE timestamp < (strftime('%s', 'now') - (90 * 86400));

-- Or archive to separate table before deleting
INSERT INTO classification_logs_archive
SELECT * FROM classification_logs
WHERE timestamp < (strftime('%s', 'now') - (90 * 86400));

DELETE FROM classification_logs
WHERE timestamp < (strftime('%s', 'now') - (90 * 86400));
```

## Monitoring Alerts (Future)

### Key Metrics to Monitor

1. **High Error Rate**
   - Alert if >10% of classifications fail in last hour
   
2. **Model Fallback Frequency**
   - Alert if >50% using paid model (free quota issues)
   
3. **Low Confidence Rate**
   - Alert if >20% have confidence <0.5
   
4. **Processing Time Spikes**
   - Alert if avg processing time >5000ms

### Example Alert Logic

```typescript
async function checkAlerts(db: D1Database): Promise<void> {
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  
  // Check error rate
  const stats = await db.prepare(`
    SELECT 
      event_type,
      COUNT(*) as count
    FROM classification_logs
    WHERE timestamp > ?
    GROUP BY event_type
  `).bind(oneHourAgo).all();
  
  const errors = stats.results.find(r => r.event_type === 'error')?.count || 0;
  const total = stats.results.reduce((sum, r) => sum + r.count, 0);
  
  if (total > 0 && (errors / total) > 0.1) {
    // Send alert (email, Slack, PagerDuty, etc.)
    console.error('ALERT: High error rate detected', {
      error_rate: errors / total,
      errors,
      total
    });
  }
}
```

## Best Practices

1. **Don't Log Sensitive Data**: Never log API keys, tokens, or personal information
2. **Use Structured Logging**: Always log as JSON for easier parsing
3. **Include Context**: Always include photo_id and relevant metadata
4. **Don't Throw on Log Errors**: Logging failures shouldn't break the app
5. **Be Selective with DB Logging**: Only save critical events to avoid bloat
6. **Regular Cleanup**: Archive or delete old logs periodically
7. **Monitor Log Volume**: Ensure you're not hitting Cloudflare's limits

## Environment Variables

```typescript
interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  ENVIRONMENT?: 'development' | 'production'; // Optional, defaults to 'production'
}

// Usage
const logger = new WorkerLogger(
  env, 
  env.ENVIRONMENT === 'development'
);
```

## Testing

```typescript
// test/logger.spec.ts

import { describe, it, expect, vi } from 'vitest';
import { WorkerLogger } from '../src/utils/logger';

describe('WorkerLogger', () => {
  it('should log info to console', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const logger = new WorkerLogger(mockEnv, false);
    
    logger.info('Test message', { photo_id: 'test123' });
    
    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('INFO');
    expect(logOutput.message).toBe('Test message');
    expect(logOutput.photo_id).toBe('test123');
  });
  
  it('should save errors to database', async () => {
    const mockDB = createMockDB();
    const logger = new WorkerLogger({ DB: mockDB }, false);
    
    await logger.error('Test error', new Error('Something failed'), {
      photo_id: 'test123'
    });
    
    expect(mockDB.prepare).toHaveBeenCalled();
  });
  
  it('should not log debug in production', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const logger = new WorkerLogger(mockEnv, false);
    
    logger.debug('Debug message');
    
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
