import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { validateEnvironment } from '../src/config/env.validation';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { PointsModule } from '../src/points/points.module';
import { PhotosModule } from '../src/photos/photos.module';
import { ReviewsModule } from '../src/reviews/reviews.module';
import { CollectionsModule } from '../src/collections/collections.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { StatisticsModule } from '../src/statistics/statistics.module';
import { SearchModule } from '../src/search/search.module';
import { UploadModule } from '../src/upload/upload.module';
import { SupabaseModule } from '../src/supabase/supabase.module';

// Mock Supabase service for tests
const MockSupabaseService = {
  getClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
    },
  }),
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: '.env.test',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'test-jwt-secret',
      signOptions: { expiresIn: '1h' },
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/snapybara-test',
      {
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            console.log('MongoDB connected for tests');
          });
          return connection;
        },
      },
    ),
    SupabaseModule.forRootAsync({
      useFactory: () => ({
        supabaseUrl: process.env.SUPABASE_URL || 'https://test.supabase.co',
        supabaseKey: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
        supabaseOptions: {
          auth: {
            persistSession: false,
          },
        },
      }),
    }),
    AuthModule,
    UsersModule,
    PointsModule,
    PhotosModule,
    ReviewsModule,
    CollectionsModule,
    NotificationsModule,
    StatisticsModule,
    SearchModule,
    UploadModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: 'SUPABASE_SERVICE',
      useValue: MockSupabaseService,
    },
  ],
})
export class TestAppModule {}
