import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';
import pino, { Logger } from 'pino';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: Logger;

  constructor(private readonly configService: ConfigService) {
    this.logger = pino({
      level: this.configService.logLevel,
      transport: this.configService.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["x-emby-token"]',
          'req.headers.cookie',
          'req.body.password',
          'req.body.apiKey',
          'req.body.token',
          'jellyfinApiKey',
          'tmdbApiKey',
          'apiKey',
          'password',
          'token',
          'authorization',
        ],
        censor: '[REDACTED]',
      },
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: this.sanitizeHeaders(req.headers),
          requestId: req.requestId,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
          headers: res.getHeaders?.(),
          requestId: res.requestId,
        }),
        err: pino.stdSerializers.err,
      },
    });
  }

  log(message: string, context?: string, requestId?: string): void {
    this.logger.info({ context, requestId }, message);
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    requestId?: string
  ): void {
    this.logger.error(
      {
        err: trace ? new Error(trace) : undefined,
        context,
        requestId,
      },
      message
    );
  }

  warn(message: string, context?: string, requestId?: string): void {
    this.logger.warn({ context, requestId }, message);
  }

  debug(message: string, context?: string, requestId?: string): void {
    this.logger.debug({ context, requestId }, message);
  }

  verbose(message: string, context?: string, requestId?: string): void {
    this.logger.trace({ context, requestId }, message);
  }

  // Structured logging methods
  logWithData(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    data: Record<string, unknown>,
    context?: string,
    requestId?: string
  ): void {
    this.logger[level]({ ...data, context, requestId }, message);
  }

  logRequest(
    req: {
      method: string;
      url: string;
      headers: Record<string, unknown>;
      requestId?: string;
    },
    message = 'Incoming request'
  ): void {
    this.logger.info(
      {
        req,
        requestId: req.requestId,
      },
      message
    );
  }

  logResponse(
    res: { statusCode: number; requestId?: string },
    duration?: number,
    message = 'Request completed'
  ): void {
    this.logger.info(
      {
        res,
        duration,
        requestId: res.requestId,
      },
      message
    );
  }

  logJob(jobId: string, message: string, data?: Record<string, unknown>): void {
    this.logger.info(
      {
        jobId,
        ...data,
      },
      message
    );
  }

  logProvider(
    provider: string,
    message: string,
    data?: Record<string, unknown>,
    requestId?: string
  ): void {
    this.logger.info(
      {
        provider,
        requestId,
        ...data,
      },
      message
    );
  }

  private sanitizeHeaders(
    headers: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized = { ...headers };

    // List of header names that should be redacted
    const sensitiveHeaders = [
      'authorization',
      'x-emby-token',
      'cookie',
      'set-cookie',
      'x-api-key',
    ];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
