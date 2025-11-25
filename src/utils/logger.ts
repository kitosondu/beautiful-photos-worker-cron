import type { Env, ClassificationLog } from '../helpers/types';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogMetadata {
    photo_id?: string;
    model_used?: 'free' | 'paid';
    processing_time_ms?: number;
    confidence_score?: number;
    error?: Error | string;
    [key: string]: any;
}

/**
 * WorkerLogger - Structured logging with database persistence for critical events
 *
 * Log levels:
 * - DEBUG: Development only, detailed information
 * - INFO: General informational messages
 * - WARN: Warning messages (saved to DB)
 * - ERROR: Error messages (saved to DB)
 */
export class WorkerLogger {
    private env: Env;
    private context: string;

    constructor(env: Env, context: string = 'worker') {
        this.env = env;
        this.context = context;
    }

    /**
     * Debug level - only in development
     */
    debug(message: string, meta?: LogMetadata): void {
        if (this.env.ENVIRONMENT === 'development') {
            console.log(this.formatLog('DEBUG', message, meta));
        }
    }

    /**
     * Info level - general information
     */
    info(message: string, meta?: LogMetadata): void {
        console.log(this.formatLog('INFO', message, meta));
    }

    /**
     * Warning level - saved to database
     */
    async warn(message: string, meta?: LogMetadata): Promise<void> {
        console.warn(this.formatLog('WARN', message, meta));
        await this.saveToDatabase('model_fallback', message, meta);
    }

    /**
     * Error level - saved to database
     */
    async error(
        message: string,
        error: Error | string,
        meta?: LogMetadata
    ): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : error;
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error(
            this.formatLog('ERROR', message, {
                ...meta,
                error: errorMessage,
                stack: errorStack,
            })
        );
        await this.saveToDatabase('error', message, {
            ...meta,
            error: errorMessage,
        });
    }

    /**
     * Log successful classification
     */
    async logSuccess(
        photoId: string,
        modelUsed: 'free' | 'paid',
        processingTime: number,
        confidence: number
    ): Promise<void> {
        await this.saveToDatabase('success', 'Classification completed', {
            photo_id: photoId,
            model_used: modelUsed,
            processing_time_ms: processingTime,
            confidence_score: confidence,
        });
    }

    /**
     * Log classification attempt
     */
    async logAttempt(photoId: string): Promise<void> {
        await this.saveToDatabase('attempt', 'Classification attempt started', {
            photo_id: photoId,
        });
    }

    /**
     * Format log message as JSON
     */
    private formatLog(
        level: LogLevel,
        message: string,
        meta?: LogMetadata
    ): string {
        const log = {
            timestamp: new Date().toISOString(),
            level,
            context: this.context,
            message,
            ...meta,
        };
        return JSON.stringify(log);
    }

    /**
     * Save critical log to database
     */
    private async saveToDatabase(
        eventType: ClassificationLog['event_type'],
        message: string,
        meta?: LogMetadata
    ): Promise<void> {
        try {
            const log: ClassificationLog = {
                timestamp: Date.now(),
                photo_id: meta?.photo_id || 'unknown',
                event_type: eventType,
                model_used: meta?.model_used,
                error_message: meta?.error ? String(meta.error) : message,
                processing_time_ms: meta?.processing_time_ms,
                confidence_score: meta?.confidence_score,
            };

            await this.env.DB.prepare(
                `INSERT INTO classification_logs
                (timestamp, photo_id, event_type, model_used, error_message, processing_time_ms, confidence_score)
                VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
                .bind(
                    log.timestamp,
                    log.photo_id,
                    log.event_type,
                    log.model_used,
                    log.error_message,
                    log.processing_time_ms,
                    log.confidence_score
                )
                .run();
        } catch (error) {
            // Don't throw on logging errors - just log to console
            console.error('Failed to save log to database:', error);
        }
    }
}
