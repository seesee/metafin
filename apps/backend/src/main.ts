import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Get configuration for Swagger setup
  const configService = app.get(NestConfigService);
  const nodeEnv = configService.get('NODE_ENV', 'development');

  // Setup OpenAPI documentation in development
  if (nodeEnv === 'development') {
    const config = new DocumentBuilder()
      .setTitle('Metafin API')
      .setDescription('A Jellyfin metadata management system for series, seasons, and episodes')
      .setVersion('1.0')
      .addTag('library', 'Library management and synchronisation')
      .addTag('collections', 'Collection management')
      .addTag('providers', 'External metadata providers')
      .addTag('metadata', 'Metadata and artwork management')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // Expose OpenAPI spec at /api/docs.json
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs.json',
      yamlDocumentUrl: 'api/docs.yaml',
    });

    logger.log('OpenAPI documentation available at /api/docs', 'Bootstrap');
  }

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

  // Allow configurable host via BACKEND_HOST environment variable
  // In development, default to all interfaces (0.0.0.0)
  // In production, default to localhost for security
  const host = configService.get('BACKEND_HOST') ||
    (process.env.NODE_ENV === 'development' ? '0.0.0.0' : '127.0.0.1');

  await app.listen(port, host);

  logger.log(`metafin backend listening on ${host}:${port}`, 'Bootstrap');
  if (basePath) {
    logger.log(`Base path: ${basePath}`, 'Bootstrap');
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
