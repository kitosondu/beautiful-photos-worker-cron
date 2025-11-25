import type { Env } from './helpers/types';
import { classifyPhotos } from './classifiers/photo-classifier';
import { getClassificationStats } from './db/classification-queries';
import { handleTestClassify } from './handlers/test-classify';

// HTTP handler for manual triggers and test endpoint
async function fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    const url = new URL(request.url);

    // Manual classification trigger
    if (url.pathname === '/classify-photos') {
        try {
            const stats = await classifyPhotos(env, 5);
            return Response.json({
                success: true,
                stats,
            });
        } catch (error) {
            return Response.json(
                {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }
    }

    // Test single photo classification with HTML interface
    if (url.pathname === '/test-classify') {
        return handleTestClassify(request, env);
    }

    // Classification statistics
    if (url.pathname === '/stats') {
        try {
            const stats = await getClassificationStats(env.DB);
            return Response.json({ success: true, stats });
        } catch (error) {
            return Response.json(
                {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }
    }

    return new Response('Beautiful Photos Worker Cron', { status: 200 });
}

// CRON job: cleanup and classification
async function scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    try {
        switch (controller.cron) {
            case '*/5 * * * *':
                // Clean up expired access tokens
                const now = Math.round(new Date().getTime() / 1000);
                const expireTime = now - 60 * 20; // 20 minutes ago
                await env.DB.prepare(
                    `DELETE FROM access_tokens WHERE created_ts < ?`
                )
                    .bind(expireTime)
                    .run();

                // Clean up classification logs older than 60 days
                const logExpireTime = now - 60 * 60 * 24 * 60; // 60 days ago
                await env.DB.prepare(
                    `DELETE FROM classification_logs WHERE created_ts < ?`
                )
                    .bind(logExpireTime)
                    .run();
                break;

            case '* * * * *':
                // Classify photos
                await classifyPhotos(env, 5);
                break;
        }

        console.log('Cron processed successfully');
    } catch (error) {
        console.error('Cron error:', error);
        throw error;
    }
}

export default { scheduled, fetch };
