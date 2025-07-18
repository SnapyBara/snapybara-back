import {
  Controller,
  Get,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SupabaseJwtGuard } from './guards/simple-jwt.guard';
import {
  AuthResponseDto,
  CurrentUserResponseDto,
  StatusResponseDto,
  ErrorResponseDto,
} from './dto/swagger-auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Get('profile')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get user profile',
    description:
      'Retrieves detailed profile information for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing JWT token',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async getProfile(@Request() req): Promise<AuthResponseDto> {
    try {
      const profile = await this.authService.getProfile(req.user.access_token);
      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      this.logger.error('Get profile failed:', error);
      throw new HttpException(
        'Failed to get user profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('me')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user info',
    description:
      'Retrieves basic information about the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user information retrieved successfully',
    type: CurrentUserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing JWT token',
    type: ErrorResponseDto,
  })
  async getCurrentUser(@Request() req): Promise<CurrentUserResponseDto> {
    return {
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        full_name: req.user.full_name,
        avatar_url: req.user.avatar_url,
        authenticated: true,
      },
    };
  }

  @Get('status')
  @ApiTags('public')
  @ApiOperation({
    summary: 'Check authentication service status',
    description:
      'Public endpoint to check if the authentication service is running',
  })
  @ApiResponse({
    status: 200,
    description: 'Service status retrieved successfully',
    type: StatusResponseDto,
  })
  getAuthStatus(): StatusResponseDto {
    return {
      status: 'OK',
      message: 'SnapyBara Auth service is running',
      authentication: 'Supabase JWT verification',
      endpoints: {
        profile: 'GET /auth/profile (protected)',
        me: 'GET /auth/me (protected)',
        status: 'GET /auth/status (public)',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
