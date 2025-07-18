import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';
import { validateEnvironment } from './config/env.validation';
import { EmailModule } from './email/email.module';
import { ProtectedModule } from './protected/protected.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: ['.env.local', '.env'],
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
    ProtectedModule,
    HealthModule,
    EmailModule,
  ],
})
export class AppModule {}
