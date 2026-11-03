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

  // Restrict CORS to the frontend origins in production (comma-separated list)
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'https://euroloo.vercel.app')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: isProd ? allowedOrigins : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Enable global validation to strip malicious/extra fields
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Warn at startup about settings that would otherwise only fail on the first request
  const missingEnv = ['CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET', 'GCS_BUCKET_NAME'].filter(
    (name) => !process.env[name],
  );
  if (missingEnv.length > 0) {
    console.warn(`Missing environment variables: ${missingEnv.join(', ')}`);
  }

  await app.listen(process.env.PORT || 4000, '0.0.0.0');
  console.log(`NestJS Server running on port ${process.env.PORT || 4000}`);
}
bootstrap().catch(console.error);
