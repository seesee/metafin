import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { LoggerService } from './modules/logger/logger.service.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for now
    })
  );

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    })
  );

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Get configuration using NestJS ConfigService directly
  const configService = app.get(NestConfigService);
  const port = configService.get('APP_PORT', 8080);
  const basePath = configService.get('BASE_PATH', '');

  // Set global prefix if BASE_PATH is configured
  if (basePath && basePath !== '/') {
    app.setGlobalPrefix(basePath.replace(/^\/+|\/+$/g, ''));
  }

  // Trust proxy if configured
  if (configService.get('TRUST_PROXY') === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  }

  await app.listen(port);

  logger.log(`metafin backend listening on port ${port}`, 'Bootstrap');
  if (basePath) {
    logger.log(`Base path: ${basePath}`, 'Bootstrap');
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
