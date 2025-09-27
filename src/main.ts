import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { EnvironmentValidator } from './common/config/validators/env.validator'
import * as cookieParser from 'cookie-parser'
import { VersionService } from './common/services/version.service'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import * as fs from 'fs'
import * as express from 'express'

EnvironmentValidator.validateEnvironment()

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.disable('x-powered-by')
  const configService = app.get(ConfigService)

  // 配置请求体大小限制
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ limit: '10mb', extended: true }))

  // Cookie 解析器
  app.use(cookieParser())

  // 静态资源（用于 swagger 自定义插件与样式）
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/api/assets',
  })

  // 全局前缀
  app.setGlobalPrefix('api', {
    exclude: ['', 'health'],
  })
  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  // 全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor(app.get(VersionService)))
  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter(app.get(VersionService)))
  // CORS
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
  // Swagger
  const description = fs.readFileSync(join(__dirname, '../docs/swagger-desc.md'), 'utf8')
  const config = new DocumentBuilder()
    .setTitle('Hikarinagi private API')
    .addServer('/api/v2', 'private API v2')
    .addBearerAuth()
    .setVersion(app.get(VersionService).getVersion())
    .setDescription(description)
    .build()
  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  })
  delete document.components?.schemas?.ObjectId
  SwaggerModule.setup('/api/docs', app, document, {
    swaggerOptions: {
      showExtensions: true,
      showCommonExtensions: true,
    },
    customJs: '/api/v2/assets/roles-badge.plugin.js',
    customCssUrl: '/api/v2/assets/roles-badge.plugin.css',
    customSiteTitle: 'Hikarinagi private API',
    customfavIcon: '/api/v2/assets/favicon.ico',
    jsonDocumentUrl: '/api/swagger.json',
  })

  const port = configService.get<number>('port')

  await app.listen(port)
  console.log(`hikarinagi backend running on: http://localhost:${port}`)
}

// 处理未捕获的异常和拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

bootstrap()
