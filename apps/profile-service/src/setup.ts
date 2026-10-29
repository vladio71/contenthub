import { INestApplication } from '@nestjs/common';
import { applyCommonSetup } from '@contenthub/common';
import { PROFILE_PREFIX } from './config';

export function configureApp(app: INestApplication): void {
  applyCommonSetup(app, {
    prefix: PROFILE_PREFIX,
    title: 'ContentHub profile-service',
    description: 'User profiles: details, preferences, avatar upload and public search.',
  });
}
