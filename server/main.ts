import { NestFactory } from '@nestjs/core';
import { ToiletsModule } from './toilets.module.js';

async function bootstrap() {
  const app = await NestFactory.create(ToiletsModule);
  app.enableCors(); // Enable CORS for client
  await app.listen(process.env.PORT || 4000);
  console.log(`NestJS Server running on port ${process.env.PORT || 4000}`);
}
bootstrap();
