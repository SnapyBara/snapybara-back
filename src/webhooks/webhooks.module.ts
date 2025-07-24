import { Module } from '@nestjs/common';
import { SupabaseWebhookController } from './supabase-webhook.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [SupabaseWebhookController],
})
export class WebhooksModule {}
