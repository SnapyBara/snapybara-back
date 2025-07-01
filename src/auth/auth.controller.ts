import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { User, Session } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { SupabaseAuthGuard } from './guards/auth.guard';
import { CurrentUserRest } from '../common/decorators/current-user.decorator';

interface AuthControllerResponse {
  user: User | null;
  session: Session | null;
  message?: string;
}

interface SignOutResponse {
  message: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    schema: {
      example: {
        user: {
          id: 'uuid',
          email: 'user@example.com',
          created_at: '2023-01-01T00:00:00Z',
        },
        session: {
          access_token: 'jwt-token',
          refresh_token: 'refresh-token',
        },
        message: 'User created successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async signUp(@Body() signupDto: SignupDto): Promise<AuthControllerResponse> {
    const response = await this.authService.signUp(
      signupDto.email,
      signupDto.password,
    );
    return {
      user: response.user,
      session: response.session as Session | null,
      message: 'User created successfully',
    };
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({
    status: 200,
    description: 'User successfully authenticated',
    schema: {
      example: {
        user: {
          id: 'uuid',
          email: 'user@example.com',
        },
        session: {
          access_token: 'jwt-token',
          refresh_token: 'refresh-token',
        },
        message: 'User signed in successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signIn(@Body() loginDto: LoginDto): Promise<AuthControllerResponse> {
    const response = await this.authService.signIn(
      loginDto.email,
      loginDto.password,
    );
    return {
      user: response.user,
      session: response.session as Session | null,
      message: 'User signed in successfully',
    };
  }

  @Post('signout')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out current user' })
  @ApiResponse({
    status: 200,
    description: 'User successfully signed out',
    schema: {
      example: {
        message: 'Successfully signed out',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async signOut(): Promise<SignOutResponse> {
    return this.authService.signOut();
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    schema: {
      example: {
        id: 'uuid',
        email: 'user@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@CurrentUserRest() user: User): User {
    return user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh authentication token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: {
          type: 'string',
          description: 'The refresh token from signin response',
        },
      },
      required: ['refresh_token'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token successfully refreshed',
    schema: {
      example: {
        user: {
          id: 'uuid',
          email: 'user@example.com',
        },
        session: {
          access_token: 'new-jwt-token',
          refresh_token: 'new-refresh-token',
        },
        message: 'Token refreshed successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body('refresh_token') refreshToken: string,
  ): Promise<AuthControllerResponse> {
    const response = await this.authService.refreshToken(refreshToken);
    return {
      user: response.user,
      session: response.session as Session | null,
      message: 'Token refreshed successfully',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'Email address to send reset link to',
        },
      },
      required: ['email'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent',
    schema: {
      example: {
        message: 'Password reset email sent',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  async resetPassword(
    @Body('email') email: string,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(email);
  }
}
