import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class AppController {
  @Get('hello')
  getHello(): { message: string; timestamp: string } {
    return {
      message: 'Hello from metafin backend!',
      timestamp: new Date().toISOString(),
    };
  }
}
