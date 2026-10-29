import { DynamicModule, Global, Module } from '@nestjs/common';
import { AccessTokenService } from './access-token';
import { JwtAuthGuard } from './jwt-auth.guard';

export interface CommonAuthOptions {
  secret: string;
  ttlSeconds?: number;
}

export type CommonAuthOptionsFactory = () => CommonAuthOptions;

/** Global module: any controller can use JwtAuthGuard without importing anything. */
@Global()
@Module({})
export class CommonAuthModule {
  static register(options: CommonAuthOptions): DynamicModule {
    return CommonAuthModule.registerAsync(() => options);
  }

  /** The factory runs when the app is created, so env vars are read late. Good for tests. */
  static registerAsync(factory: CommonAuthOptionsFactory): DynamicModule {
    return {
      module: CommonAuthModule,
      providers: [
        {
          provide: AccessTokenService,
          useFactory: (): AccessTokenService => {
            const options = factory();
            return new AccessTokenService(options.secret, options.ttlSeconds);
          },
        },
        JwtAuthGuard,
      ],
      exports: [AccessTokenService, JwtAuthGuard],
    };
  }
}
