import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@ApiTags('statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
  })
  getUserStatistics(@Param('userId') userId: string) {
    return this.statisticsService.getUserStatistics(userId);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user statistics' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
  })
  getMyStatistics(@Request() req) {
    return this.statisticsService.getUserStatistics(req.user.id);
  }

  @Get('global')
  @ApiOperation({ summary: 'Get global platform statistics' })
  @ApiResponse({
    status: 200,
    description: 'Global statistics retrieved successfully',
  })
  getGlobalStatistics() {
    return this.statisticsService.getGlobalStatistics();
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get user leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
  })
  getLeaderboard(@Query('limit') limit?: number) {
    return this.statisticsService.getLeaderboard(limit);
  }
}
