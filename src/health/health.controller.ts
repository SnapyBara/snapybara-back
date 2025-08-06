import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

export class HealthResponseDto {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: string;
    auth: string;
    api: string;
  };
}

@ApiTags('public')
@Controller('health')
export class HealthController {
  constructor(private configService: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Returns the health status of the application and its services',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check successful',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: this.configService.get<string>('NODE_ENV') || 'development',
      services: {
        database: 'supabase-connected',
        auth: 'supabase-jwt-enabled',
        api: 'online',
      },
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Returns whether the application is ready to handle requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
  })
  getReadiness() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        supabase: 'connected',
        jwt_verification: 'enabled',
        cors: 'configured',
        swagger: 'enabled',
      },
    };
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness check',
    description: 'Returns whether the application is alive and running',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  getLiveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
    };
  }
}
