import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseStrategy } from './supabase.strategy';
import { ConfigService } from '../config/env.validation';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'supabase' })],
  controllers: [AuthController],
  providers: [AuthService, SupabaseStrategy, ConfigService],
  exports: [AuthService, SupabaseStrategy],
})
export class AuthModule {}
