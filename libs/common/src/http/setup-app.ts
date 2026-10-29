import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { requestContext } from './request-context';

export interface AppSetupOptions {
  prefix: string;
  title: string;
  description: string;
}

/** Same HTTP setup for every service: prefix, request id, validation, error shape, Swagger at /docs. */
export function applyCommonSetup(app: INestApplication, options: AppSetupOptions): void {
  app.setGlobalPrefix(options.prefix);
  app.use(requestContext);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle(options.title).setDescription(options.description).setVersion('1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, document);
}
