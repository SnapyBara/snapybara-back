import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseJwtGuard } from '../auth/guards/simple-jwt.guard';
import {
  DashboardResponseDto,
  FavoritesResponseDto,
  SettingsResponseDto,
} from './dto/protected.dto';
import { ErrorResponseDto } from '../auth/dto/swagger-auth.dto';

@ApiTags('protected')
@Controller('protected')
@UseGuards(SupabaseJwtGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({
  description: 'Invalid or missing JWT token',
  type: ErrorResponseDto,
})
export class ProtectedController {
  @Get('dashboard')
  @ApiOperation({
    summary: 'Get user dashboard',
    description:
      'Retrieves user dashboard with points, activities, and personalized data',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    type: DashboardResponseDto,
  })
  getDashboard(@Request() req): DashboardResponseDto {
    return {
      success: true,
      message: `Welcome ${req.user.full_name || req.user.email}!`,
      data: {
        user_id: req.user.id,
        user_email: req.user.email,
        dashboard_data: {
          total_points: 150,
          recent_activities: [
            { type: 'check-in', location: 'Paris', points: 10 },
            { type: 'photo', location: 'Louvre', points: 25 },
            { type: 'review', location: 'Tour Eiffel', points: 15 },
          ],
        },
      },
    };
  }

  @Get('favorites')
  @ApiOperation({
    summary: 'Get user favorites',
    description:
      'Retrieves all places and locations marked as favorites by the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorites retrieved successfully',
    type: FavoritesResponseDto,
  })
  getFavorites(@Request() req): FavoritesResponseDto {
    return {
      success: true,
      user_id: req.user.id,
      favorites: [
        { id: 1, name: 'Tour Eiffel', category: 'monument' },
        { id: 2, name: 'Louvre', category: 'museum' },
        { id: 3, name: 'Jardin du Luxembourg', category: 'park' },
        { id: 4, name: 'Café de Flore', category: 'restaurant' },
      ],
    };
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Get user settings',
    description: 'Retrieves user preferences and application settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings retrieved successfully',
    type: SettingsResponseDto,
  })
  getSettings(@Request() req): SettingsResponseDto {
    return {
      success: true,
      user_id: req.user.id,
      settings: {
        notifications: true,
        location_sharing: false,
        theme: 'dark',
        language: 'fr',
      },
    };
  }
}
