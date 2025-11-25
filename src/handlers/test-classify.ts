import type { Env } from '../helpers/types';
import {
    getPhotoById,
    getPhotoClassification,
} from '../db/classification-queries';
import { classifyPhotos } from '../classifiers/photo-classifier';

/**
 * Handle test classification endpoint
 * Classifies a single photo and displays results in HTML
 *
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns HTML response with classification results
 */
export async function handleTestClassify(
    request: Request,
    env: Env
): Promise<Response> {
    const url = new URL(request.url);
    const photoId = url.searchParams.get('photo_id');
    const force = url.searchParams.get('force') === '1';

    // Show form if no photo_id provided
    if (!photoId) {
        return new Response(generateFormHTML(), {
            headers: { 'Content-Type': 'text/html' },
        });
    }

    try {
        // Get photo data
        const photo = await getPhotoById(env.DB, photoId);
        if (!photo) {
            return new Response(generateErrorHTML('Photo not found', photoId), {
                headers: { 'Content-Type': 'text/html' },
                status: 404,
            });
        }

        // Check if already classified
        let classification = await getPhotoClassification(env.DB, photoId);

        // Classify if:
        // - force=1 parameter provided, OR
        // - not classified yet, OR
        // - classification failed or pending
        const shouldClassify =
            force ||
            !classification ||
            classification.classification_status === 'failed' ||
            classification.classification_status === 'pending';

        if (shouldClassify) {
            // Reset status to allow re-classification if forcing
            if (force && classification) {
                await env.DB.prepare(
                    `UPDATE photo_classifications
                     SET classification_status = 'pending',
                         retry_count = 0,
                         error_message = NULL
                     WHERE photo_id = ?`
                )
                    .bind(photoId)
                    .run();
            }

            // Classify this photo
            await classifyPhotos(env, 1);

            // Get updated classification
            classification = await getPhotoClassification(env.DB, photoId);
        }

        if (!classification) {
            return new Response(
                generateErrorHTML('Classification failed', photoId),
                {
                    headers: { 'Content-Type': 'text/html' },
                    status: 500,
                }
            );
        }

        // Generate success HTML
        return new Response(generateSuccessHTML(photo, classification), {
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);
        return new Response(generateErrorHTML(errorMessage, photoId), {
            headers: { 'Content-Type': 'text/html' },
            status: 500,
        });
    }
}

/**
 * Generate HTML form for photo_id input
 */
function generateFormHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Photo Classification</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-top: 0;
        }
        form {
            margin-top: 20px;
        }
        input[type="text"] {
            width: 100%;
            padding: 12px;
            font-size: 16px;
            border: 2px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            margin-top: 15px;
            padding: 12px 30px;
            font-size: 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background: #0056b3;
        }
        .info {
            margin-top: 20px;
            padding: 15px;
            background: #e7f3ff;
            border-left: 4px solid #007bff;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖼️ Test Photo Classification</h1>
        <form method="GET" id="classifyForm">
            <label for="photo_id">Enter Photo ID:</label>
            <input type="text" id="photo_id" name="photo_id" placeholder="e.g., abc123xyz" required>

            <div style="margin-top: 15px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="force" name="force" value="1" style="margin-right: 8px;">
                    <span>Force re-classification (even if already completed)</span>
                </label>
            </div>

            <button type="submit">Classify Photo</button>
        </form>
        <div class="info">
            <strong>ℹ️ Info:</strong> This will classify the photo using the LLM and save results to the database.
            If the photo is already classified, it will display existing results unless "Force" is checked.
        </div>
    </div>

    <script>
        // Load saved values from localStorage on page load
        window.addEventListener('DOMContentLoaded', function() {
            const photoIdInput = document.getElementById('photo_id');
            const forceCheckbox = document.getElementById('force');

            // Load saved values
            const savedPhotoId = localStorage.getItem('test_classify_photo_id');
            const savedForce = localStorage.getItem('test_classify_force');

            if (savedPhotoId) {
                photoIdInput.value = savedPhotoId;
            }

            if (savedForce === '1') {
                forceCheckbox.checked = true;
            }
        });

        // Save values to localStorage on form submit
        document.getElementById('classifyForm').addEventListener('submit', function() {
            const photoIdInput = document.getElementById('photo_id');
            const forceCheckbox = document.getElementById('force');

            localStorage.setItem('test_classify_photo_id', photoIdInput.value);
            localStorage.setItem('test_classify_force', forceCheckbox.checked ? '1' : '0');
        });
    </script>
</body>
</html>
    `;
}

/**
 * Generate success HTML with photo and classification
 */
function generateSuccessHTML(photo: any, classification: any): string {
    const photoUrl = `${photo.data.raw_path}?w=800&q=85`;
    const confidence = (classification.confidence_score * 100).toFixed(1);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Classification Results</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1000px;
            margin: 30px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-top: 0;
        }
        .photo {
            width: 100%;
            border-radius: 8px;
            margin: 20px 0;
        }
        .status {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: bold;
            margin: 10px 0;
        }
        .status.completed { background: #d4edda; color: #155724; }
        .status.failed { background: #f8d7da; color: #721c24; }
        .tags-section {
            margin: 20px 0;
        }
        .category {
            margin: 15px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        .category h3 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .tag {
            display: inline-block;
            padding: 6px 12px;
            margin: 4px;
            background: #007bff;
            color: white;
            border-radius: 4px;
            font-size: 14px;
        }
        .tag.people { background: #28a745; }
        .tag.mood { background: #ffc107; color: #333; }
        .tag.color { background: #6f42c1; }
        .tag.quality { background: #dc3545; }
        .confidence {
            margin: 15px 0;
            padding: 15px;
            background: #e7f3ff;
            border-left: 4px solid #007bff;
            border-radius: 4px;
        }
        .back-link {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background: #6c757d;
            color: white;
            text-decoration: none;
            border-radius: 4px;
        }
        .back-link:hover {
            background: #5a6268;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Classification Results</h1>

        <div>
            <strong>Photo ID:</strong> ${photo.photo_id}<br>
            <strong>Status:</strong> <span class="status ${
                classification.classification_status
            }">${classification.classification_status}</span>
        </div>

        <img src="${photoUrl}" alt="Photo" class="photo">

        <div class="confidence">
            <strong>🎯 Confidence Score:</strong> ${confidence}%
        </div>

        <div class="tags-section">
            <div class="category">
                <h3>📸 Content Tags</h3>
                ${classification.content_tags
                    .map((tag: string) => `<span class="tag">${tag}</span>`)
                    .join('')}
            </div>

            <div class="category">
                <h3>👥 People Tags</h3>
                ${classification.people_tags
                    .map(
                        (tag: string) =>
                            `<span class="tag people">${tag}</span>`
                    )
                    .join('')}
            </div>

            <div class="category">
                <h3>😊 Mood Tags</h3>
                ${classification.mood_tags
                    .map(
                        (tag: string) => `<span class="tag mood">${tag}</span>`
                    )
                    .join('')}
            </div>

            <div class="category">
                <h3>🎨 Color Tags</h3>
                ${classification.color_tags
                    .map(
                        (tag: string) => `<span class="tag color">${tag}</span>`
                    )
                    .join('')}
            </div>

            <div class="category">
                <h3>⭐ Quality Tags</h3>
                ${classification.quality_tags
                    .map(
                        (tag: string) =>
                            `<span class="tag quality">${tag}</span>`
                    )
                    .join('')}
            </div>
        </div>

        <a href="/test-classify" class="back-link">← Test Another Photo</a>
    </div>
</body>
</html>
    `;
}

/**
 * Generate error HTML
 */
function generateErrorHTML(errorMessage: string, photoId?: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Classification Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #dc3545;
            margin-top: 0;
        }
        .error {
            padding: 15px;
            background: #f8d7da;
            border-left: 4px solid #dc3545;
            border-radius: 4px;
            color: #721c24;
            margin: 20px 0;
        }
        .back-link {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background: #6c757d;
            color: white;
            text-decoration: none;
            border-radius: 4px;
        }
        .back-link:hover {
            background: #5a6268;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Classification Error</h1>
        ${photoId ? `<p><strong>Photo ID:</strong> ${photoId}</p>` : ''}
        <div class="error">
            <strong>Error:</strong> ${errorMessage}
        </div>
        <a href="/test-classify" class="back-link">← Try Again</a>
    </div>
</body>
</html>
    `;
}
