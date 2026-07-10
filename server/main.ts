import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const helmet = require('helmet');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Apply HTTP header security safely for ESM
  app.use(helmet());

  // Restrict CORS based on environment
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProd ? 'https://euroloo.app' : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Enable global validation to strip malicious/extra fields
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(process.env.PORT || 4000, '0.0.0.0');
  console.log(`NestJS Server running on port ${process.env.PORT || 4000}`);
}
bootstrap().catch(console.error);
