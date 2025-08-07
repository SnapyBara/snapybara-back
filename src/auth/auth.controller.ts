import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SimpleJwtAuthGuard } from './guards/simple-jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { LoginDto, LoginResponseDto, RefreshTokenDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @ApiOperation({ 
    summary: 'Login with email and password (for testing/development)',
    description: 'Authenticates with Supabase and returns a JWT token'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    try {
      // Authenticate with Supabase
      const result = await this.authService.loginWithSupabase(
        loginDto.email,
        loginDto.password,
      );

      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 refresh attempts per minute
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: 'Get a new access token using a refresh token'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refreshed successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid refresh token',
  })
  async refreshToken(@Body() refreshDto: RefreshTokenDto): Promise<LoginResponseDto> {
    try {
      const result = await this.authService.refreshToken(refreshDto.refresh_token);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('verify-token')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Verify Supabase JWT token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token is valid',
  })
  async verifyToken(@Body('token') token: string) {
    if (!token) {
      throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const user = await this.authService.validateSupabaseToken(token);
      return {
        valid: true,
        user: {
          id: user.mongoId,
          supabaseId: user.supabaseId,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  @Get('profile')
  @UseGuards(SimpleJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
  })
  async getProfile(@CurrentUser() currentUser: any) {
    const user = await this.usersService.findOne(currentUser.mongoId);
    return {
      id: user._id,
      supabaseId: user.supabaseId,
      email: user.email,
      username: user.username,
      role: user.role,
      level: user.level,
      points: user.points,
      profilePicture: user.profilePicture,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @Post('refresh-user')
  @UseGuards(SimpleJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Refresh user data from Supabase' })
  async refreshUser(@CurrentUser() currentUser: any) {
    // This would typically re-sync user data with Supabase
    // For now, just return the current user data
    const user = await this.usersService.findOne(currentUser.mongoId);
    await this.usersService.updateLastLogin(currentUser.mongoId);
    return {
      message: 'User data refreshed successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        lastLoginAt: new Date(),
      },
    };
  }
}
