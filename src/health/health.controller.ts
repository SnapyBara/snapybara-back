import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check application health' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  @ApiResponse({ status: 503, description: 'Application is unhealthy' })
  async check() {
    try {
      const result = await this.health.check([
        () => this.db.pingCheck('database'),
        () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
        () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024), // 500MB
        () => this.checkSentry(),
      ]);
      
      return result;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  @Get('/liveness')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('/readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Kubernetes readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  private async checkSentry(): Promise<HealthIndicatorResult> {
    const sentryDsn = this.configService.get('SENTRY_DSN');
    const isConfigured = !!sentryDsn;
    
    return {
      sentry: {
        status: isConfigured ? 'up' : 'down',
        configured: isConfigured,
      },
    } as HealthIndicatorResult;
  }
}
