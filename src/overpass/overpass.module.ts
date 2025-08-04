import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '../cache/cache.module';
import { OverpassService } from './overpass.service';
import { OverpassController } from './overpass.controller';
import { OverpassScheduler } from './overpass.scheduler';

@Module({
  imports: [
    HttpModule.register({
      timeout: 20000,
      maxRedirects: 5,
    }),
    CacheModule, // Utiliser le module de cache global
  ],
  controllers: [OverpassController],
  providers: [OverpassService, OverpassScheduler],
  exports: [OverpassService],
})
export class OverpassModule {}
