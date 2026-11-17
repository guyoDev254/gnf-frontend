import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
  app.use(helmet())
  app.setGlobalPrefix('api')
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  })
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }))

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Northern Kenya Festival API')
    .setDescription('Ticket catalog, Paystack checkout initialization, and payment status verification.')
    .setVersion('1.0.0')
    .addCookieAuth('nkf_admin_session')
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
  })

  const port = Number(process.env.PORT ?? 6001)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
