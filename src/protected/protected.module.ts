import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProtectedController } from './protected.controller';
import { SupabaseJwtGuard } from '../auth/guards/simple-jwt.guard';

@Module({
  imports: [ConfigModule],
  controllers: [ProtectedController],
  providers: [SupabaseJwtGuard],
})
export class ProtectedModule {}
