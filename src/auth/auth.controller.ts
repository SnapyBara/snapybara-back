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
import { SimpleJwtAuthGuard } from './guards/simple-jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { LoginDto, LoginResponseDto, RefreshTokenDto } from './dto/login.dto';
import { GoogleAuthDto, AuthResponseDto } from './dto/google-auth.dto';
import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private googleClient: OAuth2Client;
  private supabaseAdmin;

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {
    // Initialiser le client Google OAuth si les variables sont présentes
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (googleClientId) {
      this.googleClient = new OAuth2Client(googleClientId);
    }

    // Initialiser Supabase Admin Client si les variables sont présentes
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @ApiOperation({
    summary: 'Login with email and password (for testing/development)',
    description: 'Authenticates with Supabase and returns a JWT token',
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
    description: 'Get a new access token using a refresh token',
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
  async refreshToken(
    @Body() refreshDto: RefreshTokenDto,
  ): Promise<LoginResponseDto> {
    try {
      const result = await this.authService.refreshToken(
        refreshDto.refresh_token,
      );
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

  // Route Google Auth (nouvelle)
  @Post('google')
  @Public()
  @ApiOperation({
    summary: 'Authenticate with Google',
    description: 'Login or register using Google OAuth',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Google authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid Google token',
  })
  async googleAuth(
    @Body() googleAuthDto: GoogleAuthDto,
  ): Promise<AuthResponseDto> {
    if (!this.googleClient || !this.supabaseAdmin) {
      throw new HttpException(
        'Google authentication is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    console.log('Google auth request received:', {
      idToken: googleAuthDto.idToken?.substring(0, 20) + '...',
    });

    try {
      const { idToken } = googleAuthDto;
      const possibleAudiences = [
        process.env.GOOGLE_CLIENT_ID!,
        '425969214880-5op5i5db0soa7120vm76oddhsgb7n6u0.apps.googleusercontent.com',
        '425969214880-5aseedacojej900khks6m387i94slv8j.apps.googleusercontent.com',
      ].filter(Boolean);

      console.log('Accepting audiences:', possibleAudiences);

      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: possibleAudiences,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
      }

      const { email, name, picture, sub: googleId } = payload;

      // Vérifier si l'utilisateur existe dans Supabase
      const { data: existingUser } =
        await this.supabaseAdmin.auth.admin.listUsers();
      let user = existingUser.users.find((u) => u.email === email);

      if (!user) {
        // Créer l'utilisateur dans Supabase
        const { data: newUser, error: createError } =
          await this.supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
              full_name: name,
              avatar_url: picture,
              google_id: googleId,
            },
          });

        if (createError) {
          console.error('Error creating user:', createError);
          throw new HttpException(
            'Failed to create user',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        user = newUser.user;
        console.log('User created successfully:', user.id);
      } else {
        console.log('User already exists:', user.id);
      }

      // Synchroniser avec MongoDB
      let mongoUser = await this.usersService.findBySupabaseId(user.id);
      if (!mongoUser) {
        mongoUser = await this.usersService.syncWithSupabase(user);
      }

      // Mettre à jour la dernière connexion
      if (mongoUser._id) {
        await this.usersService.updateLastLogin(mongoUser._id.toString());
      }

      // Générer de vrais tokens Supabase via l'Admin API
      const { data: sessionData, error: sessionError } =
        await this.supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: user.email,
          options: {
            redirectTo: `${process.env.APP_URL || 'snapybara://auth'}`,
          },
        });

      // Alternative: Créer une session directement (nécessite la clé service)
      // Générer un JWT personnalisé avec les claims Supabase
      const customToken =
        await this.authService.generateSupabaseCompatibleToken(user);

      const response: AuthResponseDto = {
        user: {
          id: user.id,
          email: user.email || '',
          created_at: user.created_at || new Date().toISOString(),
        },
        session: {
          access_token: customToken.access_token,
          refresh_token: customToken.refresh_token,
          expires_in: 3600,
          token_type: 'bearer',
        },
      };

      console.log('Returning auth response for user:', response.user.email);
      return response;
    } catch (error) {
      console.error('Google auth error:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || 'Authentication failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Get('test')
  @Public()
  async test() {
    return {
      message: 'Auth endpoint is working',
      timestamp: new Date().toISOString(),
      googleAuthEnabled: !!this.googleClient,
      supabaseAdminEnabled: !!this.supabaseAdmin,
    };
  }
}
