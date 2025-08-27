import { Controller, Get } from '@nestjs/common'
import { VersionService } from '../services/version.service'
import { ApiExcludeController } from '@nestjs/swagger'

@ApiExcludeController()
@Controller()
export class AppController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  getAppInfo() {
    return {
      name: 'Hikarinagi backend nestjs',
      version: this.versionService.getVersion(),
      message: '',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      version: this.versionService.getVersion(),
    }
  }
}
