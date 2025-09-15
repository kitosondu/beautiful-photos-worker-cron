interface Env {
    DB: any;
}

// This function is required
async function fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return new Response('Hello World!');
}

// CRON job: delete expired access tokens
async function scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
) {
    const now = Math.round(new Date().getTime() / 1000);
    const expireTime = now - 60 * 20; // 20 minutes ago
    await env.DB.prepare(
        `
            delete from access_tokens where created_ts < ?
        `
    )
        .bind(expireTime)
        .run();

    console.log('cron processed');
}

export default { scheduled, fetch };
