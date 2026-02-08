import { Controller, Get } from '@nestjs/common';

@Controller() // root path
export class AppController {
  @Get('health')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
