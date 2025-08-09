import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SimpleJwtAuthGuard } from '../auth/guards/simple-jwt-auth.guard';
import { CacheService } from './cache.service';

@ApiTags('cache')
@Controller('cache')
@UseGuards(SimpleJwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Returns cache hit/miss statistics',
  })
  async getStats() {
    return this.cacheService.getStats();
  }

  @Delete('reset')
  @ApiOperation({
    summary: 'Clear all cache',
    description:
      'WARNING: Clears all cached data (not available in this cache-manager version)',
  })
  async resetCache() {
    return {
      message: 'Cache reset not available in this version',
      suggestion: 'Use specific cache key deletion instead',
    };
  }
}
