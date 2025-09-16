export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Provider errors
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  PROVIDER_RATE_LIMITED = 'PROVIDER_RATE_LIMITED',
  PROVIDER_AUTH_ERROR = 'PROVIDER_AUTH_ERROR',
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',

  // Jellyfin errors
  JELLYFIN_ERROR = 'JELLYFIN_ERROR',
  JELLYFIN_UNAVAILABLE = 'JELLYFIN_UNAVAILABLE',
  JELLYFIN_AUTH_ERROR = 'JELLYFIN_AUTH_ERROR',
  JELLYFIN_NOT_FOUND = 'JELLYFIN_NOT_FOUND',
  JELLYFIN_WRITE_ERROR = 'JELLYFIN_WRITE_ERROR',

  // General errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // Configuration errors
  CONFIG_ERROR = 'CONFIG_ERROR',
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',

  // Job/Operation errors
  JOB_ERROR = 'JOB_ERROR',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
}

export interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetails;
  public readonly requestId?: string;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode = 500,
    isOperational = true,
    details?: ErrorDetails,
    requestId?: string
  ) {
    super(message);

    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.requestId = requestId;

    if ('captureStackTrace' in Error) {
      (
        Error as {
          captureStackTrace: (obj: object, fn: CallableFunction) => void;
        }
      ).captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
      ...(this.requestId && { requestId: this.requestId }),
      timestamp: new Date().toISOString(),
    };
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }

  // Factory methods for common error types
  static validation(
    message: string,
    details?: ErrorDetails,
    requestId?: string
  ): AppError {
    return new AppError(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      true,
      details,
      requestId
    );
  }

  static notFound(
    message = 'Resource not found',
    details?: ErrorDetails,
    requestId?: string
  ): AppError {
    return new AppError(
      message,
      ErrorCode.NOT_FOUND,
      404,
      true,
      details,
      requestId
    );
  }

  static conflict(
    message: string,
    details?: ErrorDetails,
    requestId?: string
  ): AppError {
    return new AppError(
      message,
      ErrorCode.CONFLICT,
      409,
      true,
      details,
      requestId
    );
  }

  static providerError(
    provider: string,
    message: string,
    statusCode = 502,
    details?: ErrorDetails,
    requestId?: string
  ): AppError {
    return new AppError(
      `Provider ${provider}: ${message}`,
      ErrorCode.PROVIDER_ERROR,
      statusCode,
      true,
      { provider, ...details },
      requestId
    );
  }

  static jellyfinError(
    message: string,
    statusCode = 502,
    details?: ErrorDetails,
    requestId?: string
  ): AppError {
    return new AppError(
      `Jellyfin: ${message}`,
      ErrorCode.JELLYFIN_ERROR,
      statusCode,
      true,
      details,
      requestId
    );
  }

  static timeout(
    message = 'Operation timed out',
    details?: ErrorDetails,
    requestId?: string
  ): AppError {
    return new AppError(
      message,
      ErrorCode.TIMEOUT,
      408,
      true,
      details,
      requestId
    );
  }

  static internal(
    message = 'Internal server error',
    details?: ErrorDetails,
    requestId?: string
  ): AppError {
    return new AppError(
      message,
      ErrorCode.INTERNAL_ERROR,
      500,
      false,
      details,
      requestId
    );
  }

  static config(message: string, details?: ErrorDetails): AppError {
    return new AppError(message, ErrorCode.CONFIG_ERROR, 500, true, details);
  }
}
