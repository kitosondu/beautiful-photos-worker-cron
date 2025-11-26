import type {
    Env,
    ClassificationStats,
    Photo,
    PhotoData,
} from '../helpers/types';
import { WorkerLogger } from '../utils/logger';
import { generatePhotoUrl } from '../helpers/photo-url';
import { classifyPhotoWithFallback } from '../api/openrouter-client';
import {
    getUnclassifiedPhotos,
    getPhotoById,
    markPhotoAsProcessing,
    saveClassification,
    saveClassificationError,
} from '../db/classification-queries';

/**
 * Main classification orchestrator
 * Processes a batch of unclassified photos
 *
 * @param env - Worker environment with DB and API key
 * @param limit - Maximum number of photos to process
 * @returns Statistics about the classification batch
 */
export async function classifyPhotos(
    env: Env,
    limit: number = 3
): Promise<ClassificationStats> {
    const logger = new WorkerLogger(env, 'photo-classifier');
    const stats: ClassificationStats = {
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
    };

    try {
        // 1. Get unclassified photos
        const photos = await getUnclassifiedPhotos(env.DB, limit);

        if (photos.length === 0) {
            logger.info('No photos to classify');
            return stats;
        }

        logger.info(`Found ${photos.length} photos to classify`);

        // 2. Process each photo
        for (const photo of photos) {
            stats.processed++;

            try {
                await classifySinglePhoto(env, photo, logger);
                stats.successful++;
            } catch (error) {
                stats.failed++;
                await logger.error(
                    `Failed to classify photo ${photo.photo_id}`,
                    error instanceof Error ? error : String(error),
                    { photo_id: photo.photo_id }
                );

                // Save error to database
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                await saveClassificationError(
                    env.DB,
                    photo.photo_id,
                    errorMessage
                );
            }
        }

        logger.info('Classification batch completed', {
            processed: stats.processed,
            successful: stats.successful,
            failed: stats.failed,
        });

        return stats;
    } catch (error) {
        await logger.error(
            'Critical error in classification batch',
            error instanceof Error ? error : String(error)
        );
        throw error;
    }
}

/**
 * Classify a single photo
 *
 * @param env - Worker environment
 * @param photo - Photo record from database
 * @param logger - Logger instance
 */
async function classifySinglePhoto(
    env: Env,
    photo: Photo,
    logger: WorkerLogger
): Promise<void> {
    const startTime = Date.now();

    // 1. Mark as processing immediately to prevent concurrent classification
    await markPhotoAsProcessing(env.DB, photo.photo_id);
    await logger.logAttempt(photo.photo_id);

    // 2. Parse photo data to get raw_path
    let photoData: PhotoData;
    try {
        photoData = JSON.parse(photo.data_json);
    } catch (error) {
        throw new Error(`Failed to parse photo data_json: ${error}`);
    }

    if (!photoData.raw_path) {
        throw new Error('Photo data missing raw_path');
    }

    // 3. Generate photo URL
    const photoUrl = generatePhotoUrl(photoData.raw_path);
    logger.debug(`Generated photo URL: ${photoUrl}`, {
        photo_id: photo.photo_id,
    });

    // 4. Classify with LLM (with automatic fallback)
    const { result, modelUsed } = await classifyPhotoWithFallback(
        photoUrl,
        env.OPENROUTER_API_KEY,
        logger,
        photo.photo_id
    );

    logger.debug(`Classification result received`, {
        photo_id: photo.photo_id,
        model_used: modelUsed,
        confidence: result.confidence_score,
    });

    // 5. Save classification to database
    await saveClassification(env.DB, photo.photo_id, result);

    // 6. Log success
    const processingTime = Date.now() - startTime;
    await logger.logSuccess(
        photo.photo_id,
        modelUsed,
        processingTime,
        result.confidence_score
    );

    logger.info(`Photo classified successfully`, {
        photo_id: photo.photo_id,
        model_used: modelUsed,
        confidence: result.confidence_score,
        processing_time_ms: processingTime,
    });
}

/**
 * Classify a specific photo by ID
 * Used for testing and manual re-classification
 *
 * @param env - Worker environment with DB and API key
 * @param photoId - Specific photo ID to classify
 * @throws Error if photo not found or classification fails
 */
export async function classifyPhotoById(
    env: Env,
    photoId: string
): Promise<void> {
    const logger = new WorkerLogger(env, 'photo-classifier');

    // Get photo from database
    const photoWithData = await getPhotoById(env.DB, photoId);

    if (!photoWithData) {
        throw new Error(`Photo not found: ${photoId}`);
    }

    // Convert to Photo format for classifySinglePhoto
    const photo: Photo = {
        photo_id: photoWithData.photo_id,
        data_json: photoWithData.data_json,
        created_ts: photoWithData.created_ts,
    };

    // Classify the photo
    await classifySinglePhoto(env, photo, logger);
}
