import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PointsModule } from './points/points.module';
import { PhotosModule } from './photos/photos.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SearchModule } from './search/search.module';
import { OverpassModule } from './overpass/overpass.module';
import { GooglePlacesModule } from './google-places/google-places.module';
import { EmailModule } from './email/email.module';
import { UploadModule } from './upload/upload.module';
import { HealthModule } from './health/health.module';
import { GraphqlModule } from './graphql/graphql.module';
import { CacheModule as CustomCacheModule } from './cache/cache.module';
import { SupabaseModule } from './supabase/supabase.module';

import { SecurityLoggingInterceptor } from './common/interceptors/security-logging.interceptor';
import { SecurityMiddleware } from './common/middleware/security.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    SupabaseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        supabaseUrl: configService.get<string>('SUPABASE_URL')!,
        supabaseKey: configService.get<string>('SUPABASE_ANON_KEY')!,
        supabaseServiceKey: configService.get<string>('SUPABASE_SERVICE_KEY')!,
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/snapybara',
        retryWrites: true,
        w: 'majority',
      }),
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: 60 * 60,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    PointsModule,
    PhotosModule,
    WebhooksModule,
    SearchModule,
    OverpassModule,
    GooglePlacesModule,
    EmailModule,
    UploadModule,
    HealthModule,
    GraphqlModule,
    CustomCacheModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
