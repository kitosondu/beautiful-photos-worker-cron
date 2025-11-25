import type {
    Photo,
    PhotoData,
    ClassificationResult,
    PhotoClassification,
} from '../helpers/types';

/**
 * Get unclassified photos from database
 * Includes photos that are:
 * - Never classified (status IS NULL)
 * - Failed with retry_count < 3
 * - Processing for more than 5 minutes (stuck)
 *
 * @param db - D1 Database instance
 * @param limit - Maximum number of photos to return
 * @returns Array of photos to classify
 */
export async function getUnclassifiedPhotos(
    db: D1Database,
    limit: number
): Promise<Photo[]> {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const result = await db
        .prepare(
            `SELECT p.photo_id, p.data_json, p.created_ts
            FROM photos p
            LEFT JOIN photo_classifications pc ON p.photo_id = pc.photo_id
            WHERE pc.photo_id IS NULL
               OR (pc.classification_status = 'failed' AND pc.retry_count < 3)
               OR (pc.classification_status = 'processing' AND pc.last_attempt_ts < ?)
            ORDER BY p.created_ts DESC
            LIMIT ?`
        )
        .bind(fiveMinutesAgo, limit)
        .all<Photo>();

    return result.results || [];
}

/**
 * Mark photo as processing to prevent concurrent classification
 *
 * @param db - D1 Database instance
 * @param photoId - Photo ID
 */
export async function markPhotoAsProcessing(
    db: D1Database,
    photoId: string
): Promise<void> {
    const now = Date.now();

    await db
        .prepare(
            `INSERT INTO photo_classifications (photo_id, all_tags_searchable, classification_status, last_attempt_ts, retry_count)
            VALUES (?, '', 'processing', ?, 0)
            ON CONFLICT(photo_id) DO UPDATE SET
                classification_status = 'processing',
                last_attempt_ts = ?,
                retry_count = retry_count + 1`
        )
        .bind(photoId, now, now)
        .run();
}

/**
 * Save classification result to database
 * This is a complex operation that:
 * 1. Builds all_tags_searchable string
 * 2. Updates photo_classifications table
 * 3. Manages tags table (insert or increment usage)
 * 4. Creates photo_tags relationships
 *
 * @param db - D1 Database instance
 * @param photoId - Photo ID
 * @param classification - Classification result from LLM
 */
export async function saveClassification(
    db: D1Database,
    photoId: string,
    classification: ClassificationResult
): Promise<void> {
    const now = Date.now();

    // 1. Build all_tags_searchable string
    const allTags = [
        ...classification.content_tags,
        ...classification.people_tags,
        ...classification.mood_tags,
        ...classification.color_tags,
        ...classification.quality_tags,
    ];
    const allTagsSearchable = allTags.join(' ');

    // 2. Update photo_classifications table
    await db
        .prepare(
            `UPDATE photo_classifications
            SET all_tags_searchable = ?,
                classification_status = 'completed',
                confidence_score = ?,
                completed_ts = ?
            WHERE photo_id = ?`
        )
        .bind(allTagsSearchable, classification.confidence_score, now, photoId)
        .run();

    // 3. Delete old photo_tags relationships
    await db
        .prepare(`DELETE FROM photo_tags WHERE photo_id = ?`)
        .bind(photoId)
        .run();

    // 4. Process each category of tags
    const tagCategories: Array<{
        tags: string[];
        category: 'content' | 'people' | 'mood' | 'color' | 'quality';
    }> = [
        { tags: classification.content_tags, category: 'content' },
        { tags: classification.people_tags, category: 'people' },
        { tags: classification.mood_tags, category: 'mood' },
        { tags: classification.color_tags, category: 'color' },
        { tags: classification.quality_tags, category: 'quality' },
    ];

    for (const { tags, category } of tagCategories) {
        for (const tagName of tags) {
            // Insert tag or increment usage_count
            await db
                .prepare(
                    `INSERT INTO tags (tag_name, tag_category, usage_count, created_ts)
                    VALUES (?, ?, 1, ?)
                    ON CONFLICT(tag_name) DO UPDATE SET
                        usage_count = usage_count + 1`
                )
                .bind(tagName, category, now)
                .run();

            // Get tag_id
            const tagResult = await db
                .prepare(`SELECT tag_id FROM tags WHERE tag_name = ?`)
                .bind(tagName)
                .first<{ tag_id: number }>();

            if (tagResult) {
                // Create photo_tags relationship
                await db
                    .prepare(
                        `INSERT OR IGNORE INTO photo_tags (photo_id, tag_id)
                        VALUES (?, ?)`
                    )
                    .bind(photoId, tagResult.tag_id)
                    .run();
            }
        }
    }
}

/**
 * Save classification error to database
 *
 * @param db - D1 Database instance
 * @param photoId - Photo ID
 * @param errorMessage - Error message
 */
export async function saveClassificationError(
    db: D1Database,
    photoId: string,
    errorMessage: string
): Promise<void> {
    await db
        .prepare(
            `UPDATE photo_classifications
            SET classification_status = 'failed',
                error_message = ?
            WHERE photo_id = ?`
        )
        .bind(errorMessage, photoId)
        .run();
}

/**
 * Get photo by ID with parsed data
 *
 * @param db - D1 Database instance
 * @param photoId - Photo ID
 * @returns Photo with parsed data or null
 */
export async function getPhotoById(
    db: D1Database,
    photoId: string
): Promise<(Photo & { data: PhotoData }) | null> {
    const photo = await db
        .prepare(
            `SELECT photo_id, data_json, created_ts FROM photos WHERE photo_id = ?`
        )
        .bind(photoId)
        .first<Photo>();

    if (!photo) {
        return null;
    }

    try {
        const data: PhotoData = JSON.parse(photo.data_json);
        return { ...photo, data };
    } catch (error) {
        throw new Error(`Failed to parse photo data_json: ${error}`);
    }
}

/**
 * Get photo classification with all tags organized by category
 *
 * @param db - D1 Database instance
 * @param photoId - Photo ID
 * @returns Classification with categorized tags or null
 */
export async function getPhotoClassification(
    db: D1Database,
    photoId: string
): Promise<
    | (PhotoClassification & {
          content_tags: string[];
          people_tags: string[];
          mood_tags: string[];
          color_tags: string[];
          quality_tags: string[];
      })
    | null
> {
    // Get classification record
    const classification = await db
        .prepare(
            `SELECT photo_id, all_tags_searchable, classification_status, confidence_score,
                    retry_count, last_attempt_ts, completed_ts, error_message
            FROM photo_classifications
            WHERE photo_id = ?`
        )
        .bind(photoId)
        .first<PhotoClassification>();

    if (!classification) {
        return null;
    }

    // Get tags by category
    const tagsResult = await db
        .prepare(
            `SELECT t.tag_name, t.tag_category
            FROM photo_tags pt
            JOIN tags t ON pt.tag_id = t.tag_id
            WHERE pt.photo_id = ?
            ORDER BY t.tag_category, t.tag_name`
        )
        .bind(photoId)
        .all<{ tag_name: string; tag_category: string }>();

    const tags = tagsResult.results || [];

    // Organize tags by category
    const content_tags = tags
        .filter((t) => t.tag_category === 'content')
        .map((t) => t.tag_name);
    const people_tags = tags
        .filter((t) => t.tag_category === 'people')
        .map((t) => t.tag_name);
    const mood_tags = tags
        .filter((t) => t.tag_category === 'mood')
        .map((t) => t.tag_name);
    const color_tags = tags
        .filter((t) => t.tag_category === 'color')
        .map((t) => t.tag_name);
    const quality_tags = tags
        .filter((t) => t.tag_category === 'quality')
        .map((t) => t.tag_name);

    return {
        ...classification,
        content_tags,
        people_tags,
        mood_tags,
        color_tags,
        quality_tags,
    };
}

/**
 * Get classification statistics
 *
 * @param db - D1 Database instance
 * @returns Statistics object
 */
export async function getClassificationStats(db: D1Database): Promise<{
    total_photos: number;
    classified: number;
    pending: number;
    failed: number;
    processing: number;
}> {
    const result = await db
        .prepare(
            `SELECT
                COUNT(DISTINCT p.photo_id) as total_photos,
                COUNT(DISTINCT CASE WHEN pc.classification_status = 'completed' THEN pc.photo_id END) as classified,
                COUNT(DISTINCT CASE WHEN pc.classification_status = 'pending' OR pc.photo_id IS NULL THEN p.photo_id END) as pending,
                COUNT(DISTINCT CASE WHEN pc.classification_status = 'failed' THEN pc.photo_id END) as failed,
                COUNT(DISTINCT CASE WHEN pc.classification_status = 'processing' THEN pc.photo_id END) as processing
            FROM photos p
            LEFT JOIN photo_classifications pc ON p.photo_id = pc.photo_id`
        )
        .first<{
            total_photos: number;
            classified: number;
            pending: number;
            failed: number;
            processing: number;
        }>();

    return (
        result || {
            total_photos: 0,
            classified: 0,
            pending: 0,
            failed: 0,
            processing: 0,
        }
    );
}
