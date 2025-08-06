import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '../cache/cache.module';
import { OverpassService } from './overpass.service';
import { OverpassController } from './overpass.controller';
import { OverpassScheduler } from './overpass.scheduler';
import { PhotoEnrichmentService } from './photo-enrichment.service';
import { OverpassMonitorService } from './overpass-monitor.service';
import { ConfigModule } from '@nestjs/config';

// New optimized services
import { TileService } from './services/tile.service';
import { QueueService } from './services/queue.service';
import { ClusterService } from './services/cluster.service';
import { OptimizedSearchService } from './services/optimized-search.service';

// Admin controller
import { OverpassAdminController } from './admin/overpass-admin.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 20000,
      maxRedirects: 5,
    }),
    CacheModule,
    ConfigModule,
    EventEmitterModule.forRoot(), // Add event emitter for queue processing
  ],
  controllers: [
    OverpassController,
    OverpassAdminController, // Add admin controller
  ],
  providers: [
    OverpassService,
    OverpassScheduler,
    PhotoEnrichmentService,
    OverpassMonitorService,
    // New services
    TileService,
    QueueService,
    ClusterService,
    OptimizedSearchService,
  ],
  exports: [
    OverpassService,
    PhotoEnrichmentService,
    OverpassMonitorService,
    TileService,
    QueueService,
    ClusterService,
    OptimizedSearchService,
  ],
})
export class OverpassModule {}
