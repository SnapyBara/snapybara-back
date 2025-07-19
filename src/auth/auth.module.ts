import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseSimpleService } from '../supabase/supabase-simple.service';
import { SupabaseJwtGuard } from './guards/simple-jwt.guard';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseSimpleService, SupabaseJwtGuard],
  exports: [AuthService, SupabaseJwtGuard, SupabaseSimpleService],
})
export class AuthModule {}
