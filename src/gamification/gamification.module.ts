import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UsersModule, NotificationsModule],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
