import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OptimizedSearchService } from '../services/optimized-search.service';
import { QueueService, QueueMetrics } from '../services/queue.service';
import { TileService } from '../services/tile.service';
import { CacheService } from '../../cache/cache.service';
// import { AdminGuard } from '../../auth/guards/admin.guard'; // Uncomment if you have admin auth

@ApiTags('Overpass Admin')
@Controller('admin/overpass')
// @UseGuards(AdminGuard) // Uncomment to protect endpoints
// @ApiBearerAuth('JWT-auth')
export class OverpassAdminController {
  constructor(
    private readonly optimizedSearchService: OptimizedSearchService,
    private readonly queueService: QueueService,
    private readonly tileService: TileService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Get service health and metrics' })
  @ApiResponse({ status: 200, description: 'Service health information' })
  async getHealth() {
    const health = await this.optimizedSearchService.getServiceHealth();
    const queueStatus = await this.queueService.getQueueStatus();

    return {
      ...health,
      queue: {
        status: queueStatus,
        metrics: this.queueService.getMetrics(),
      },
    };
  }

  @Post('queue/clear')
  @ApiOperation({ summary: 'Clear all queued requests' })
  @ApiResponse({ status: 200, description: 'Queues cleared' })
  async clearQueues() {
    this.queueService.clearQueues();
    return { message: 'All queues cleared successfully' };
  }

  @Post('cache/clear')
  @ApiOperation({ summary: 'Clear all cached data' })
  @ApiResponse({ status: 200, description: 'Cache cleared' })
  async clearCache() {
    await this.optimizedSearchService.clearCache();
    return { message: 'Cache cleared successfully' };
  }

  @Post('precompute')
  @ApiOperation({ summary: 'Manually trigger precomputation of popular areas' })
  @ApiResponse({ status: 200, description: 'Precomputation started' })
  async triggerPrecompute(@Body() body: { force?: boolean }) {
    // Run in background
    this.optimizedSearchService
      .precomputePopularAreas(body.force || false)
      .catch((err) => console.error('Precompute failed:', err));

    return { message: 'Precomputation started in background' };
  }

  @Get('queue/status')
  @ApiOperation({ summary: 'Get detailed queue status' })
  @ApiResponse({ status: 200, description: 'Queue status' })
  async getQueueStatus() {
    const status = await this.queueService.getQueueStatus();
    const metrics = this.queueService.getMetrics();

    return {
      queues: status,
      metrics,
      recommendations: this.getRecommendations(metrics),
    };
  }

  @Post('rate-limit/adjust')
  @ApiOperation({ summary: 'Manually adjust rate limiting' })
  @ApiResponse({ status: 200, description: 'Rate limiting adjusted' })
  async adjustRateLimit() {
    this.queueService.adjustRateLimiting();
    return { message: 'Rate limiting adjusted based on current metrics' };
  }

  @Post('maintenance')
  @ApiOperation({ summary: 'Run maintenance tasks manually' })
  @ApiResponse({ status: 200, description: 'Maintenance started' })
  async runMaintenance() {
    // Run in background
    this.optimizedSearchService
      .performDailyMaintenance()
      .catch((err) => console.error('Maintenance failed:', err));

    return { message: 'Maintenance tasks started in background' };
  }

  private getRecommendations(metrics: QueueMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.queueLength > 100) {
      recommendations.push(
        'Queue backlog is high. Consider clearing low priority queries.',
      );
    }

    if (metrics.failedQueries / metrics.totalQueries > 0.2) {
      recommendations.push(
        'High failure rate detected. Check Overpass server status.',
      );
    }

    if (metrics.processingRate < 1) {
      recommendations.push(
        'Processing rate is low. Consider adjusting rate limits.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating normally.');
    }

    return recommendations;
  }
}
