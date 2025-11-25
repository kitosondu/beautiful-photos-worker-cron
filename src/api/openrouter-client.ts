import type {
    ClassificationResult,
    OpenRouterRequest,
    OpenRouterResponse,
} from '../helpers/types';
import { CLASSIFICATION_PROMPT } from '../prompts/classification-prompt';
import { WorkerLogger } from '../utils/logger';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FREE_MODEL = 'google/gemma-3-27b-it:free';
const PAID_MODEL = 'google/gemma-3-27b-it';

/**
 * Call OpenRouter API to classify a photo
 *
 * @param photoUrl - URL of the photo to classify
 * @param apiKey - OpenRouter API key
 * @param model - Model to use (free or paid)
 * @returns Classification result
 */
async function callOpenRouterAPI(
    photoUrl: string,
    apiKey: string,
    model: string
): Promise<ClassificationResult> {
    const request: OpenRouterRequest = {
        model,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: CLASSIFICATION_PROMPT,
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: photoUrl,
                        },
                    },
                ],
            },
        ],
        temperature: 0.3,
        max_tokens: 1000,
    };

    const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://beautiful-photos.app',
            'X-Title': 'Beautiful Photos Classification',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`
        );
    }

    const data: OpenRouterResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
        throw new Error('OpenRouter API returned no choices');
    }

    const content = data.choices[0].message.content;
    return parseClassificationResponse(content);
}

/**
 * Classify a photo with automatic fallback from free to paid model
 *
 * @param photoUrl - URL of the photo to classify
 * @param apiKey - OpenRouter API key
 * @param logger - Logger instance
 * @param photoId - Photo ID for logging
 * @returns Classification result and model used
 */
export async function classifyPhotoWithFallback(
    photoUrl: string,
    apiKey: string,
    logger: WorkerLogger,
    photoId: string
): Promise<{ result: ClassificationResult; modelUsed: 'free' | 'paid' }> {
    try {
        // Try free model first
        const result = await callOpenRouterAPI(photoUrl, apiKey, FREE_MODEL);
        return { result, modelUsed: 'free' };
    } catch (error) {
        // Log fallback to paid model
        await logger.warn('Falling back to paid model', {
            photo_id: photoId,
            error: error instanceof Error ? error.message : String(error),
        });

        // Try paid model
        const result = await callOpenRouterAPI(photoUrl, apiKey, PAID_MODEL);
        return { result, modelUsed: 'paid' };
    }
}

/**
 * Parse and validate classification response from LLM
 *
 * @param content - Raw response content from LLM
 * @returns Parsed and validated classification result
 */
function parseClassificationResponse(content: string): ClassificationResult {
    // Remove markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '');
    } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```\n?/g, '');
    }

    // Parse JSON
    let parsed: any;
    try {
        parsed = JSON.parse(jsonContent);
    } catch (error) {
        throw new Error(
            `Failed to parse classification JSON: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }

    // Validate structure
    if (!parsed.content_tags || !Array.isArray(parsed.content_tags)) {
        throw new Error('Missing or invalid content_tags');
    }
    if (!parsed.people_tags || !Array.isArray(parsed.people_tags)) {
        throw new Error('Missing or invalid people_tags');
    }
    if (!parsed.mood_tags || !Array.isArray(parsed.mood_tags)) {
        throw new Error('Missing or invalid mood_tags');
    }
    if (!parsed.color_tags || !Array.isArray(parsed.color_tags)) {
        throw new Error('Missing or invalid color_tags');
    }
    if (!parsed.quality_tags || !Array.isArray(parsed.quality_tags)) {
        throw new Error('Missing or invalid quality_tags');
    }

    // Validate confidence
    const confidence =
        typeof parsed.confidence === 'number' ? parsed.confidence : 0.0;
    if (confidence < 0 || confidence > 1) {
        throw new Error(`Invalid confidence score: ${confidence}`);
    }

    // Validate people tags
    const hasPeople =
        parsed.people_tags.includes('people') ||
        parsed.people_tags.includes('no_people');
    if (!hasPeople) {
        throw new Error(
            'people_tags must include either "people" or "no_people"'
        );
    }

    // Validate close/distant for people
    if (parsed.people_tags.includes('people')) {
        const hasProximity =
            parsed.people_tags.includes('close') ||
            parsed.people_tags.includes('distant');
        if (!hasProximity) {
            throw new Error(
                'people_tags with "people" must include either "close" or "distant"'
            );
        }
    }

    // Validate minimum tags
    if (parsed.content_tags.length < 2) {
        throw new Error('content_tags must have at least 2 tags');
    }
    if (parsed.mood_tags.length < 1) {
        throw new Error('mood_tags must have at least 1 tag');
    }
    if (parsed.color_tags.length < 2) {
        throw new Error('color_tags must have at least 2 tags');
    }
    if (parsed.quality_tags.length < 2) {
        throw new Error('quality_tags must have at least 2 tags');
    }

    return {
        content_tags: parsed.content_tags,
        people_tags: parsed.people_tags,
        mood_tags: parsed.mood_tags,
        color_tags: parsed.color_tags,
        quality_tags: parsed.quality_tags,
        confidence_score: confidence,
    };
}
