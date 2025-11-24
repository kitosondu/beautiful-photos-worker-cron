# Test Endpoint Documentation

## Overview

The test endpoint `/test-classify` allows manual classification of individual photos with visual result display. It serves as both a development tool and a way to verify classification quality.

## Endpoint Specification

### URL
```
GET /test-classify?photo_id={photo_id}
```

### Parameters
- `photo_id` (required): The ID of the photo to classify

### Response
- Content-Type: `text/html`
- Status: 200 (success), 400 (missing parameter), 404 (photo not found), 500 (error)

## Behavior

The endpoint performs the **same classification process as the cron job**, but for a single specified photo:

1. Query photo from database by ID
2. Generate optimized Unsplash URL
3. Call OpenRouter API (with free→paid fallback)
4. Parse and validate classification result
5. **Save to database** (same as cron)
6. Display results in HTML page

## Implementation

```typescript
// src/handlers/test-classify.ts

import { WorkerLogger } from '../utils/logger';
import { generatePhotoUrl } from '../helpers/photo-url';
import { classifyPhotoWithFallback } from '../classifiers/photo-classifier';
import { saveClassification } from '../db/classification-queries';
import { getPhotoById } from '../db/photo-queries';

export async function handleTestClassify(
  request: Request,
  env: Env
): Promise<Response> {
  const logger = new WorkerLogger(env, env.ENVIRONMENT === 'development');
  const url = new URL(request.url);
  const photoId = url.searchParams.get('photo_id');

  // Validate parameter
  if (!photoId) {
    return new Response(
      generateErrorHTML('Missing required parameter: photo_id'),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }

  try {
    // 1. Get photo from database
    logger.info('Test classification started', { photo_id: photoId });
    
    const photo = await getPhotoById(env.DB, photoId);
    if (!photo) {
      return new Response(
        generateErrorHTML(`Photo not found: ${photoId}`),
        {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      );
    }

    // 2. Generate photo URL
    const photoUrl = generatePhotoUrl(photo.raw_path, 600, 80);

    // 3. Classify photo (with fallback)
    const startTime = Date.now();
    const { result, modelUsed } = await classifyPhotoWithFallback(
      photoUrl,
      env.OPENROUTER_API_KEY,
      logger,
      photoId
    );
    const duration = Date.now() - startTime;

    logger.info('Classification successful', {
      photo_id: photoId,
      model_used: modelUsed,
      confidence: result.confidence_score,
      processing_time_ms: duration
    });

    // 4. Save to database
    await saveClassification(env.DB, photoId, result);
    
    logger.info('Classification saved to database', { photo_id: photoId });

    // 5. Generate HTML response
    const html = generateSuccessHTML({
      photoId,
      photoUrl,
      classification: result,
      duration,
      modelUsed,
      timestamp: new Date().toISOString()
    });

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    logger.error('Test classification failed', error, { photo_id: photoId });

    return new Response(
      generateErrorHTML(`Classification error: ${error.message}`),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
}
```

## HTML Templates

### Success Page

```typescript
interface SuccessData {
  photoId: string;
  photoUrl: string;
  classification: ClassificationResult;
  duration: number;
  modelUsed: 'free' | 'paid';
  timestamp: string;
}

function generateSuccessHTML(data: SuccessData): string {
  const formattedJSON = JSON.stringify(
    {
      content_tags: data.classification.content_tags,
      people_tags: data.classification.people_tags,
      mood_tags: data.classification.mood_tags,
      color_tags: data.classification.color_tags,
      quality_tags: data.classification.quality_tags,
      confidence_score: data.classification.confidence_score
    },
    null,
    2
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photo Classification Test - ${data.photoId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .header h1 {
      color: #2d3748;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .status {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      background: #48bb78;
      color: white;
      margin-left: 12px;
    }
    .model-badge {
      display: inline-block;
      margin-top: 12px;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
    }
    .model-badge.free {
      background: #d4edda;
      color: #155724;
    }
    .model-badge.paid {
      background: #fff3cd;
      color: #856404;
    }
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .card {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .card h2 {
      color: #2d3748;
      font-size: 20px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .photo-section img {
      width: 100%;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .metadata {
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .metadata-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .metadata-item:last-child {
      border-bottom: none;
    }
    .metadata-label {
      color: #718096;
      font-weight: 600;
    }
    .metadata-value {
      color: #2d3748;
      font-family: 'Courier New', monospace;
    }
    .json-container {
      background: #1a202c;
      color: #a0aec0;
      padding: 24px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Courier New', Monaco, monospace;
      font-size: 14px;
      line-height: 1.6;
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.3);
    }
    .json-container pre {
      margin: 0;
      color: #e2e8f0;
    }
    .json-key { color: #fc8181; }
    .json-string { color: #68d391; }
    .json-number { color: #f6ad55; }
    .json-boolean { color: #63b3ed; }
    .json-null { color: #cbd5e0; }
    .footer {
      text-align: center;
      padding: 20px;
      color: white;
      margin-top: 20px;
    }
    .footer a {
      color: white;
      text-decoration: underline;
    }
    @media (max-width: 968px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        🤖 Photo Classification Test
        <span class="status">✓ Success</span>
      </h1>
      <div class="model-badge ${data.modelUsed}">
        Model Used: ${data.modelUsed === 'free' ? '🎉 Free (google/gemma-3-27b-it:free)' : '💰 Paid (google/gemma-3-27b-it)'}
      </div>
    </div>

    <div class="content-grid">
      <div class="card photo-section">
        <h2>📷 Photo</h2>
        <img src="${data.photoUrl}" alt="Classified photo" loading="lazy">
        
        <div class="metadata">
          <div class="metadata-item">
            <span class="metadata-label">Photo ID</span>
            <span class="metadata-value">${data.photoId}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Processing Time</span>
            <span class="metadata-value">${duration}ms</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Confidence Score</span>
            <span class="metadata-value">${(data.classification.confidence_score * 100).toFixed(1)}%</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Timestamp</span>
            <span class="metadata-value">${data.timestamp}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Saved to Database</span>
            <span class="metadata-value">✓ Yes</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>🎯 Classification Result (JSON)</h2>
        <div class="json-container">
          <pre>${formattedJSON}</pre>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Test another photo: <code>/test-classify?photo_id=YOUR_PHOTO_ID</code></p>
      <p style="margin-top: 10px; opacity: 0.8; font-size: 14px;">
        This endpoint performs the same classification process as the cron job
      </p>
    </div>
  </div>
</body>
</html>`;
}
```

### Error Page

```typescript
function generateErrorHTML(errorMessage: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Classification Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .error-container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 600px;
      text-align: center;
    }
    .error-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #e53e3e;
      font-size: 24px;
      margin-bottom: 16px;
    }
    .error-message {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
      background: #fed7d7;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #e53e3e;
      text-align: left;
      font-family: 'Courier New', monospace;
    }
    .help-text {
      margin-top: 24px;
      color: #718096;
      font-size: 14px;
    }
    code {
      background: #edf2f7;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">⚠️</div>
    <h1>Classification Error</h1>
    <div class="error-message">${errorMessage}</div>
    <div class="help-text">
      <p>Usage: <code>/test-classify?photo_id=YOUR_PHOTO_ID</code></p>
      <p style="margin-top: 12px;">Make sure the photo ID exists in the database.</p>
    </div>
  </div>
</body>
</html>`;
}
```

## Integration with Main Worker

```typescript
// src/index.ts

import { handleTestClassify } from './handlers/test-classify';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Test classify endpoint
    if (url.pathname === '/test-classify') {
      return await handleTestClassify(request, env);
    }

    // Existing manual trigger endpoint
    if (url.pathname === '/classify-photos') {
      // ... existing code
    }

    return new Response('Beautiful Photos Worker Cron', {
      headers: { 'Content-Type': 'text/plain' }
    });
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // ... existing cron code
  }
};
```

## Helper Functions

### Get Photo by ID

```typescript
// src/db/photo-queries.ts

export async function getPhotoById(
  db: D1Database,
  photoId: string
): Promise<Photo | null> {
  const result = await db
    .prepare('SELECT * FROM photos WHERE photo_id = ?')
    .bind(photoId)
    .first<Photo>();

  return result || null;
}
```

### Classify with Fallback

```typescript
// src/classifiers/photo-classifier.ts

interface ClassificationWithModel {
  result: ClassificationResult;
  modelUsed: 'free' | 'paid';
}

export async function classifyPhotoWithFallback(
  photoUrl: string,
  apiKey: string,
  logger: WorkerLogger,
  photoId: string
): Promise<ClassificationWithModel> {
  const DEFAULT_MODEL = 'google/gemma-3-27b-it:free';
  const FALLBACK_MODEL = 'google/gemma-3-27b-it';

  try {
    // Try free model first
    const result = await callOpenRouterAPI(photoUrl, apiKey, DEFAULT_MODEL);
    return { result, modelUsed: 'free' };
  } catch (error) {
    // Log fallback attempt
    await logger.warn('Falling back to paid model', {
      photo_id: photoId,
      model_used: 'free',
      error: error.message
    });

    // Try paid model
    const result = await callOpenRouterAPI(photoUrl, apiKey, FALLBACK_MODEL);
    return { result, modelUsed: 'paid' };
  }
}
```

## Usage Examples

### Test Single Photo

```bash
# Local development
curl "http://localhost:8787/test-classify?photo_id=abc123"

# Or open in browser
open "http://localhost:8787/test-classify?photo_id=abc123"

# Production
curl "https://your-worker.workers.dev/test-classify?photo_id=abc123"
```

### Test with Different Photos

```bash
# Nature photo
/test-classify?photo_id=nature-mountain-001

# Urban photo
/test-classify?photo_id=city-street-042

# Portrait photo
/test-classify?photo_id=portrait-woman-015
```

## Testing Checklist

Use the test endpoint to verify:

- [ ] Photos without people classify correctly
- [ ] Photos with close people get "close" tag
- [ ] Photos with distant people get "distant" tag
- [ ] Content tags are relevant
- [ ] Mood tags match the atmosphere
- [ ] Color tags match dominant colors
- [ ] Quality tags are accurate
- [ ] Confidence scores are reasonable (>0.7 typically)
- [ ] Free model works (most cases)
- [ ] Fallback to paid model works (during rate limits)
- [ ] Results are saved to database
- [ ] Error handling works (invalid photo_id)

## Troubleshooting

### Photo Not Found
```
Error: Photo not found: abc123
```
**Solution**: Verify photo_id exists in database
```sql
SELECT photo_id FROM photos WHERE photo_id = 'abc123';
```

### API Key Error
```
Error: OpenRouter API error: 401 Unauthorized
```
**Solution**: Check `OPENROUTER_API_KEY` environment variable

### Rate Limit Error
```
Warning: Falling back to paid model
Reason: rate_limit
```
**Expected**: Free model hit rate limit, automatically using paid model

### Low Confidence
```
Confidence Score: 35.2%
```
**Solution**: Review photo quality or prompt. May need manual review.

## Performance Metrics

Typical processing times:
- **Free model**: 2-4 seconds
- **Paid model**: 1-3 seconds
- **Database save**: <100ms
- **Total**: 2-5 seconds

## Security Considerations

1. **No Authentication**: Currently open endpoint
   - Consider adding basic auth for production
   - Or restrict to internal IPs only

2. **Rate Limiting**: No built-in rate limiting
   - Consider adding request throttling
   - Monitor for abuse

3. **Input Validation**: Basic validation only
   - Photo ID format validation
   - SQL injection protection via prepared statements

## Future Enhancements

1. **Batch Testing**: Test multiple photos at once
2. **Comparison View**: Compare with existing classification
3. **Re-classification**: Force re-classify already classified photos
4. **Export Results**: Download classification as JSON
5. **Visual Tag Editor**: Edit tags manually after classification
6. **Tag Statistics**: Show tag frequency and distribution
