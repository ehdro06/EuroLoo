import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module.js';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const helmet = require('helmet');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Cloud Run sits behind Google's front end, which appends the real client IP to
  // X-Forwarded-For. Trusting only that hop makes `req.ip` ignore spoofed values.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
  app.set('trust proxy', trustProxyHops);

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
