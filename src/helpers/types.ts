// photos.data_json structure
export interface PhotoData {
    photo_id: string;
    raw_path: string;
    small_path: string;
    full_path: string;
    photo_url: string;
    user_fullname: string;
    user_profile: string;
    user_profile_image: string;
    photo_location: string;
    download_tracking_url: string;
    exif: any;
    photo_width: number;
    photo_height: number;
    blur_hash: string;
    created_at: string;
}

// Photo record from database
export interface Photo {
    photo_id: string;
    data_json: string;
    created_ts: number;
}

// Photo classification main table
export interface PhotoClassification {
    photo_id: string;
    all_tags_searchable: string;
    classification_status: 'pending' | 'processing' | 'completed' | 'failed';
    confidence_score?: number;
    retry_count: number;
    last_attempt_ts?: number;
    completed_ts?: number;
    error_message?: string;
}

// Tag dictionary
export interface Tag {
    tag_id: number;
    tag_name: string;
    tag_category: 'content' | 'people' | 'mood' | 'color' | 'quality';
    usage_count: number;
    created_ts: number;
}

// Photo-tag relationship
export interface PhotoTag {
    photo_id: string;
    tag_id: number;
}

// Classification result from LLM
export interface ClassificationResult {
    content_tags: string[];
    people_tags: string[];
    mood_tags: string[];
    color_tags: string[];
    quality_tags: string[];
    confidence_score: number;
}

// Classification log entry
export interface ClassificationLog {
    id?: number;
    timestamp: number;
    photo_id: string;
    event_type: 'attempt' | 'success' | 'error' | 'model_fallback';
    model_used?: 'free' | 'paid';
    error_message?: string;
    processing_time_ms?: number;
    confidence_score?: number;
}

// Classification statistics
export interface ClassificationStats {
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
}

// OpenRouter API request
export interface OpenRouterRequest {
    model: string;
    messages: Array<{
        role: 'system' | 'user';
        content:
            | string
            | Array<{
                  type: string;
                  text?: string;
                  image_url?: { url: string };
              }>;
    }>;
    temperature?: number;
    max_tokens?: number;
}

// OpenRouter API response
export interface OpenRouterResponse {
    id: string;
    model: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    error?: {
        code: number;
        message: string;
    };
}

// Environment bindings
export interface Env {
    DB: D1Database;
    OPENROUTER_API_KEY: string;
    ENVIRONMENT?: 'development' | 'production';
}
