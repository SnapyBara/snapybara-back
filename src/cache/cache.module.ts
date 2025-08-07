import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        ttl: 3600, // TTL par défaut: 1 heure
      }),
    }),
    AuthModule, // Import du AuthModule pour résoudre les dépendances du SimpleJwtAuthGuard
  ],
  controllers: [CacheController],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
