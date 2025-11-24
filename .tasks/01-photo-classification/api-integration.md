# OpenRouter API Integration

## Overview

This document details the integration with OpenRouter API for photo classification using Gemma 3 27B IT model. It covers API configuration, request/response formats, error handling, and best practices.

## OpenRouter Configuration

### API Endpoint
```
https://openrouter.ai/api/v1/chat/completions
```

### Model Selection Strategy

**Primary Model (Default):**
```
google/gemma-3-27b-it:free
```

**Fallback Model (on errors):**
```
google/gemma-3-27b-it
```

**Why Gemma 3 27B?**
- Strong vision capabilities for image analysis
- Good balance of accuracy and cost
- Fast response times
- Available through OpenRouter with competitive pricing
- Free tier available for development and testing

**Fallback Strategy:**
- Always try the free model first
- On ANY error (rate limit, model error, etc.), automatically fallback to paid model
- Log all fallbacks to database for cost tracking
- This ensures maximum reliability while minimizing costs

### Authentication
```typescript
headers: {
  'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://beautiful-photos.example.com', // Optional
  'X-Title': 'Beautiful Photos Classification' // Optional
}
```

## Request Format

### Single Image Request

```typescript
interface OpenRouterRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
      };
    }>;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}
```

### Example Request (Single Photo)

```typescript
const request: OpenRouterRequest = {
  model: 'google/gemma-3-27b-it',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this photo and classify it into categories...` // See prompt below
        },
        {
          type: 'image_url',
          image_url: {
            url: 'https://images.unsplash.com/photo-123?w=600&q=80',
            detail: 'auto'
          }
        }
      ]
    }
  ],
  max_tokens: 1000,
  temperature: 0.3, // Lower temperature for more consistent results
  top_p: 0.9
};
```

### Batch Processing (Multiple Images)

**To Be Verified**: Check if OpenRouter/Gemma 3 supports multiple images in single request.

```typescript
// Potential batch format (if supported)
const batchRequest = {
  model: 'google/gemma-3-27b-it',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze these photos and return an array of classifications...`
        },
        {
          type: 'image_url',
          image_url: { url: 'https://images.unsplash.com/photo-1?w=600&q=80' }
        },
        {
          type: 'image_url',
          image_url: { url: 'https://images.unsplash.com/photo-2?w=600&q=80' }
        },
        // ... up to 5 images
      ]
    }
  ]
};
```

**Fallback**: If batch not supported, make individual API calls (still efficient due to async I/O).

## Classification Prompt

### Structured Prompt Template

```typescript
const CLASSIFICATION_PROMPT = `Analyze this photo and classify it into the following categories.
Return ONLY a valid JSON object with these exact keys (no markdown, no code blocks):

{
  "content_tags": [],
  "people_tags": [],
  "mood_tags": [],
  "color_tags": [],
  "quality_tags": [],
  "confidence": 0.0
}

CATEGORY GUIDELINES:

1. CONTENT TAGS (2-5 tags): What's physically in the photo
   Core tags: nature, mountains, forest, beach, ocean, desert, sky, clouds, urban, city, architecture, building, street, interior, food, technology, vehicle, sports, art, music, fashion, abstract, underwater, aerial, wildlife, flowers
   Add custom tags for unique content

2. PEOPLE TAGS (1-5 tags): Human presence and proximity
   REQUIRED: Include either "no_people" OR "people"
   If "people" present, REQUIRED: Include either "close" OR "distant"
   
   "close" criteria (ANY ONE triggers it):
   - Portrait shots (face is main subject)
   - Person within 1-2 meters of camera
   - Person occupies more than 30% of frame
   
   Additional tags: single, couple, small_group, group, crowd, man, woman, child, faces_visible, faces_hidden, portrait, interaction, walking, sitting
   
3. MOOD TAGS (2-4 tags): Emotional atmosphere
   Core tags: peaceful, serene, joyful, energetic, dramatic, mysterious, romantic, contemplative, melancholic, playful, inspiring, moody, bold
   Add custom tags for unique moods

4. COLOR TAGS (2-5 tags): Dominant colors and characteristics
   Individual colors: red, orange, yellow, green, blue, purple, pink, brown, black, white, gray
   Characteristics: warm_tones, cold_tones, monochrome, colorful, vibrant, muted, pastel, high_contrast, low_contrast, golden_hour, blue_hour
   Add custom color tags if needed

5. QUALITY TAGS (3-6 tags): Technical quality and style
   Core tags: sharp, blurred, bokeh, professional, amateur, grainy, well_lit, low_light, well_composed, cinematic, vintage, HDR, black_and_white, natural_lighting, dramatic_lighting, wide_angle
   Add custom quality tags

IMPORTANT RULES:
- Use lowercase with underscores for multi-word tags
- Select most relevant tags only (don't over-tag)
- Be specific and accurate
- Confidence should reflect your certainty (0.0 to 1.0)
- Return ONLY the JSON object, nothing else

Example output:
{
  "content_tags": ["nature", "mountains", "snow", "sky"],
  "people_tags": ["no_people"],
  "mood_tags": ["peaceful", "majestic", "inspiring"],
  "color_tags": ["blue", "white", "cold_tones", "high_contrast"],
  "quality_tags": ["sharp", "professional", "well_composed", "natural_lighting"],
  "confidence": 0.95
}`;
```

## Response Format

### Expected Response Structure

```typescript
interface OpenRouterResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string; // JSON string with classification
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### Example Response

```json
{
  "id": "gen-abc123",
  "model": "google/gemma-3-27b-it",
  "created": 1700000000,
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"content_tags\":[\"nature\",\"mountains\",\"snow\",\"sky\"],\"people_tags\":[\"no_people\"],\"mood_tags\":[\"peaceful\",\"majestic\"],\"color_tags\":[\"blue\",\"white\",\"cold_tones\"],\"quality_tags\":[\"sharp\",\"professional\",\"well_composed\"],\"confidence\":0.95}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 450,
    "completion_tokens": 85,
    "total_tokens": 535
  }
}
```

## Implementation

### Core API Client Function

```typescript
async function callOpenRouterAPI(
  photoUrl: string,
  apiKey: string,
  model: string = 'google/gemma-3-27b-it:free'
): Promise<ClassificationResult> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://beautiful-photos.example.com',
      'X-Title': 'Beautiful Photos Classification'
    },
    body: JSON.stringify({
      model, // Use provided model (free or paid)
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CLASSIFICATION_PROMPT },
            { 
              type: 'image_url', 
              image_url: { 
                url: photoUrl,
                detail: 'auto'
              } 
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      top_p: 0.9
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data: OpenRouterResponse = await response.json();
  return parseClassificationResponse(data);
}
```

### Fallback Wrapper Function

```typescript
interface ClassificationWithModel {
  result: ClassificationResult;
  modelUsed: 'free' | 'paid';
}

async function classifyPhotoWithFallback(
  photoUrl: string,
  apiKey: string,
  logger: WorkerLogger,
  photoId: string
): Promise<ClassificationWithModel> {
  const DEFAULT_MODEL = 'google/gemma-3-27b-it:free';
  const FALLBACK_MODEL = 'google/gemma-3-27b-it';

  try {
    // Try free model first
    logger.info('Attempting classification with free model', {
      photo_id: photoId,
      model: DEFAULT_MODEL
    });
    
    const result = await callOpenRouterAPI(photoUrl, apiKey, DEFAULT_MODEL);
    
    logger.info('Free model classification successful', {
      photo_id: photoId,
      confidence: result.confidence_score
    });
    
    return { result, modelUsed: 'free' };
    
  } catch (error) {
    // Log fallback attempt (saves to DB)
    await logger.warn('Falling back to paid model', {
      photo_id: photoId,
      model_used: 'free',
      error: error.message,
      reason: error.message.includes('429') ? 'rate_limit' : 'error'
    });

    // Try paid model
    logger.info('Attempting classification with paid model', {
      photo_id: photoId,
      model: FALLBACK_MODEL
    });
    
    const result = await callOpenRouterAPI(photoUrl, apiKey, FALLBACK_MODEL);
    
    logger.info('Paid model classification successful', {
      photo_id: photoId,
      confidence: result.confidence_score
    });
    
    return { result, modelUsed: 'paid' };
  }
}
```

### Response Parser

```typescript
function parseClassificationResponse(
  response: OpenRouterResponse
): ClassificationResult {
  try {
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    // Parse JSON from response
    const classification = JSON.parse(content);

    // Validate required fields
    if (!Array.isArray(classification.content_tags)) {
      throw new Error('Invalid content_tags');
    }
    if (!Array.isArray(classification.people_tags)) {
      throw new Error('Invalid people_tags');
    }
    if (!Array.isArray(classification.mood_tags)) {
      throw new Error('Invalid mood_tags');
    }
    if (!Array.isArray(classification.color_tags)) {
      throw new Error('Invalid color_tags');
    }
    if (!Array.isArray(classification.quality_tags)) {
      throw new Error('Invalid quality_tags');
    }

    // Validate people_tags rules
    const hasPeople = classification.people_tags.includes('people');
    const hasNoPeople = classification.people_tags.includes('no_people');
    const hasClose = classification.people_tags.includes('close');
    const hasDistant = classification.people_tags.includes('distant');

    if (!hasPeople && !hasNoPeople) {
      throw new Error('Missing required people presence tag');
    }
    if (hasPeople && !hasClose && !hasDistant) {
      throw new Error('Missing required people proximity tag');
    }

    return {
      content_tags: classification.content_tags,
      people_tags: classification.people_tags,
      mood_tags: classification.mood_tags,
      color_tags: classification.color_tags,
      quality_tags: classification.quality_tags,
      confidence_score: classification.confidence || 0.5,
      tokens_used: response.usage.total_tokens
    };
  } catch (error) {
    throw new Error(`Failed to parse classification: ${error.message}`);
  }
}
```

### Photo URL Generation

```typescript
function generatePhotoUrl(rawPath: string, width: number = 600, quality: number = 80): string {
  // Unsplash raw_path format: photo-{id}
  // Generate URL with optimization parameters
  return `https://images.unsplash.com/${rawPath}?w=${width}&q=${quality}`;
}

// Example usage
const photoUrl = generatePhotoUrl('photo-1234567890', 600, 80);
// Result: https://images.unsplash.com/photo-1234567890?w=600&q=80
```

## Error Handling

### Common Error Types

```typescript
enum APIErrorType {
  NETWORK_ERROR = 'network_error',
  AUTH_ERROR = 'auth_error',
  RATE_LIMIT = 'rate_limit_error',
  INVALID_RESPONSE = 'invalid_response',
  PARSE_ERROR = 'parse_error',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server_error'
}

interface APIError {
  type: APIErrorType;
  message: string;
  statusCode?: number;
  retryable: boolean;
}
```

### Error Handling Logic

```typescript
async function classifyPhotoWithRetry(
  photoUrl: string,
  apiKey: string,
  maxRetries: number = 3
): Promise<ClassificationResult> {
  let lastError: APIError | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callOpenRouterAPI(photoUrl, apiKey);
    } catch (error) {
      lastError = categorizeError(error);
      
      // Don't retry non-retryable errors
      if (!lastError.retryable) {
        throw lastError;
      }

      // Log retry attempt
      console.log(`Retry ${attempt + 1}/${maxRetries} for photo classification`, {
        error: lastError.message,
        photoUrl
      });

      // Wait before retry (simple strategy, no exponential backoff needed)
      if (attempt < maxRetries - 1) {
        await sleep(1000); // 1 second delay
      }
    }
  }

  throw lastError || new Error('Classification failed after retries');
}

function categorizeError(error: any): APIError {
  // Network errors
  if (error.message?.includes('fetch failed') || error.message?.includes('network')) {
    return {
      type: APIErrorType.NETWORK_ERROR,
      message: 'Network error occurred',
      retryable: true
    };
  }

  // HTTP status errors
  if (error.message?.includes('401') || error.message?.includes('403')) {
    return {
      type: APIErrorType.AUTH_ERROR,
      message: 'Authentication failed',
      retryable: false
    };
  }

  if (error.message?.includes('429')) {
    return {
      type: APIErrorType.RATE_LIMIT,
      message: 'Rate limit exceeded',
      retryable: true
    };
  }

  if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) {
    return {
      type: APIErrorType.SERVER_ERROR,
      message: 'Server error',
      retryable: true
    };
  }

  // Parse errors
  if (error.message?.includes('parse') || error.message?.includes('JSON')) {
    return {
      type: APIErrorType.PARSE_ERROR,
      message: 'Failed to parse response',
      retryable: false
    };
  }

  // Default
  return {
    type: APIErrorType.INVALID_RESPONSE,
    message: error.message || 'Unknown error',
    retryable: false
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Rate Limiting & Quotas

### OpenRouter Limits
- Check OpenRouter dashboard for current limits
- Free tier may have reduced quotas
- Implement exponential backoff for 429 errors

### Cost Management
```typescript
// Track API usage
interface UsageStats {
  total_requests: number;
  total_tokens: number;
  estimated_cost: number;
  last_reset: number;
}

// Log usage after each request
function logUsage(tokensUsed: number) {
  // Gemma 3 27B pricing (check OpenRouter for current rates)
  const costPerToken = 0.0000001; // Example rate
  const cost = tokensUsed * costPerToken;
  
  console.log('API Usage:', {
    tokens: tokensUsed,
    estimated_cost: cost
  });
}
```

## Performance Optimization

### Image URL Optimization
```typescript
// Use appropriate image size for classification
// Smaller images = faster processing, lower costs
const CLASSIFICATION_IMAGE_WIDTH = 600; // pixels
const CLASSIFICATION_IMAGE_QUALITY = 80; // 0-100

// For batch processing, consider even smaller sizes
const BATCH_IMAGE_WIDTH = 400;
```

### Request Timeout
```typescript
const CLASSIFICATION_TIMEOUT = 30000; // 30 seconds

async function callOpenRouterWithTimeout(
  photoUrl: string,
  apiKey: string,
  timeout: number = CLASSIFICATION_TIMEOUT
): Promise<ClassificationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { /* ... */ },
      body: JSON.stringify({ /* ... */ }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return parseClassificationResponse(await response.json());
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Classification request timeout');
    }
    throw error;
  }
}
```

## Testing & Validation

### Test API Connection
```typescript
async function testOpenRouterConnection(apiKey: string): Promise<boolean> {
  try {
    const testUrl = 'https://images.unsplash.com/photo-test?w=400&q=80';
    const result = await callOpenRouterAPI(testUrl, apiKey);
    return result.confidence_score > 0;
  } catch (error) {
    console.error('OpenRouter connection test failed:', error);
    return false;
  }
}
```

### Validate Classification Quality
```typescript
function validateClassification(result: ClassificationResult): boolean {
  // Check minimum tag counts
  if (result.content_tags.length < 2) return false;
  if (result.people_tags.length < 1) return false;
  if (result.mood_tags.length < 1) return false;
  if (result.color_tags.length < 2) return false;
  if (result.quality_tags.length < 2) return false;

  // Check people tags rules
  const hasPeople = result.people_tags.includes('people');
  const hasNoPeople = result.people_tags.includes('no_people');
  if (!hasPeople && !hasNoPeople) return false;

  if (hasPeople) {
    const hasProximity = result.people_tags.includes('close') || 
                        result.people_tags.includes('distant');
    if (!hasProximity) return false;
  }

  // Check confidence threshold
  if (result.confidence_score < 0.3) return false;

  return true;
}
```

## Monitoring & Logging

### Request Logging
```typescript
interface ClassificationLog {
  photo_id: string;
  timestamp: number;
  duration_ms: number;
  tokens_used: number;
  confidence: number;
  success: boolean;
  error?: string;
}

async function classifyWithLogging(
  photoId: string,
  photoUrl: string,
  apiKey: string
): Promise<ClassificationResult> {
  const startTime = Date.now();
  const log: ClassificationLog = {
    photo_id: photoId,
    timestamp: startTime,
    duration_ms: 0,
    tokens_used: 0,
    confidence: 0,
    success: false
  };

  try {
    const result = await callOpenRouterAPI(photoUrl, apiKey);
    log.duration_ms = Date.now() - startTime;
    log.tokens_used = result.tokens_used;
    log.confidence = result.confidence_score;
    log.success = true;
    return result;
  } catch (error) {
    log.duration_ms = Date.now() - startTime;
    log.error = error.message;
    throw error;
  } finally {
    console.log('Classification log:', log);
  }
}
```

## Model Fallback Strategy Details

### Why Fallback on ALL Errors?

Instead of trying to detect specific error types, we fallback on **any error** for simplicity and reliability:

**Advantages:**
- **Simpler Logic**: No need to parse error types and codes
- **More Reliable**: Handles unexpected errors gracefully
- **User Experience**: Ensures classifications always complete
- **Cost Effective**: Only pay for paid model when free model fails

**Error Types that Trigger Fallback:**
- Rate limit exceeded (429)
- Model unavailable (503)
- Request timeout
- Invalid response format
- Any other API error

### Cost Monitoring

Track paid model usage:

```typescript
// In database logs
SELECT 
  DATE(timestamp, 'unixepoch') as date,
  model_used,
  COUNT(*) as count
FROM classification_logs
WHERE model_used IS NOT NULL
GROUP BY date, model_used
ORDER BY date DESC;

// Expected: >90% should be 'free', <10% 'paid'
```

### Cost Optimization Tips

1. **Monitor Free Quota**: Check OpenRouter dashboard regularly
2. **Rate Limit Awareness**: Free tier has lower rate limits
3. **Batch Timing**: Space out cron runs if hitting rate limits often
4. **Alert on High Paid Usage**: Set up alerts if >20% using paid model

## Future Enhancements

1. **Batch API Support**: Implement if/when OpenRouter supports multiple images per request
2. **Caching**: Cache classifications to avoid re-processing
3. **Model Switching**: Support multiple models based on requirements
4. **Streaming Responses**: Use streaming if supported for faster initial results
5. **Custom Fine-tuning**: Train custom model for better tag consistency
6. **Smart Fallback**: Use cheaper models for simpler photos, expensive for complex ones
