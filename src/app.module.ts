import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';
import { validateEnvironment } from './config/env.validation';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DatabaseConfig } from './config/database.config';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { PointsModule } from './points/points.module';
import { PhotosModule } from './photos/photos.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CollectionsModule } from './collections/collections.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StatisticsModule } from './statistics/statistics.module';
import { SearchModule } from './search/search.module';
import { UploadModule } from './upload/upload.module';
import { GraphqlModule } from './graphql/graphql.module';
import { GooglePlacesModule } from './google-places/google-places.module';
import { CacheModule } from './cache/cache.module';
import { OverpassModule } from './overpass/overpass.module';
import { SentryInterceptor } from './common/interceptors/sentry.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    CacheModule,
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000, // Convert to milliseconds
        limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
      },
    ]),
    MongooseModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    SupabaseModule.forRootAsync({
      useFactory: () => ({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_ANON_KEY!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        supabaseOptions: {
          auth: {
            persistSession: false,
          },
        },
      }),
    }),
    AuthModule,
    UsersModule,
    WebhooksModule,
    HealthModule,
    EmailModule,
    PointsModule,
    PhotosModule,
    ReviewsModule,
    CollectionsModule,
    NotificationsModule,
    StatisticsModule,
    SearchModule,
    UploadModule,
    GraphqlModule,
    GooglePlacesModule,
    OverpassModule,
  ],
  controllers: [],
  providers: [
    DatabaseConfig,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
