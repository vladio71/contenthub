import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { applyCommonSetup } from '@contenthub/common';
import { AUTH_PREFIX } from './config';

/** Shared by main.ts and the tests, so tests run the same pipes, filters and prefix. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  applyCommonSetup(app, {
    prefix: AUTH_PREFIX,
    title: 'ContentHub auth-service',
    description: 'GitHub style OAuth2 login. Returns a short-lived JWT and a rotating refresh token.',
  });
}
