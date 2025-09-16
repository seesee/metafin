import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, ErrorCode } from '@metafin/shared';
import { LoggerService } from '../../modules/logger/logger.service.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    let status: number;
    let code: string;
    let message: string;
    let details: Record<string, unknown> | undefined;

    if (AppError.isAppError(exception)) {
      // Handle application errors
      status = exception.statusCode;
      code = exception.code;
      message = exception.message;
      details = exception.details;

      this.logger.error(
        `AppError: ${message}`,
        exception.stack,
        'GlobalExceptionFilter',
        request.requestId
      );
    } else if (exception instanceof HttpException) {
      // Handle NestJS HTTP exceptions
      status = exception.getStatus();
      code = this.mapHttpStatusToErrorCode(status);
      message = exception.message;

      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        details = response as Record<string, unknown>;
      }

      this.logger.error(
        `HttpException: ${message}`,
        exception.stack,
        'GlobalExceptionFilter',
        request.requestId
      );
    } else {
      // Handle unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ErrorCode.INTERNAL_ERROR;
      message = 'Internal server error';

      this.logger.error(
        `Unexpected error: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
        'GlobalExceptionFilter',
        request.requestId
      );

      // Don't expose internal error details in production
      if (!this.isProduction()) {
        details = {
          originalError:
            exception instanceof Error ? exception.message : String(exception),
        };
      }
    }

    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        ...(details && { details }),
      },
    };

    response.status(status).json(errorResponse);
  }

  private mapHttpStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.JELLYFIN_AUTH_ERROR;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.JELLYFIN_AUTH_ERROR;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.REQUEST_TIMEOUT:
        return ErrorCode.TIMEOUT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.PROVIDER_RATE_LIMITED;
      case HttpStatus.INTERNAL_SERVER_ERROR:
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
