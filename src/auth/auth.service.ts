import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabase: SupabaseClient;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async validateSupabaseToken(token: string): Promise<any> {
    try {
      // Verify the JWT token with Supabase
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        this.logger.warn(`Invalid token: ${error?.message || 'No user found'}`);
        throw new UnauthorizedException('Invalid authentication token');
      }

      // Get or sync user from MongoDB
      let mongoUser = await this.usersService.findBySupabaseId(user.id);

      if (!mongoUser) {
        // If user doesn't exist in MongoDB, sync it
        mongoUser = await this.usersService.syncWithSupabase(user);
      }

      // Update last login
      if (mongoUser._id) {
        await this.usersService.updateLastLogin(mongoUser._id.toString());
      }

      this.logger.log(
        `User authenticated: ${mongoUser.username} (${mongoUser.email})`,
      );

      return {
        supabaseId: user.id,
        mongoId: mongoUser._id?.toString() || '',
        email: user.email,
        username: mongoUser.username,
        role: mongoUser.role || 'user',
        isActive: mongoUser.isActive,
      };
    } catch (error) {
      this.logger.error('Token validation failed:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async validateUserById(supabaseId: string): Promise<any> {
    const mongoUser = await this.usersService.findBySupabaseId(supabaseId);

    if (!mongoUser || !mongoUser.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      supabaseId,
      mongoId: mongoUser._id?.toString() || '',
      email: mongoUser.email,
      username: mongoUser.username,
      role: mongoUser.role || 'user',
      isActive: mongoUser.isActive,
    };
  }

  async loginWithSupabase(email: string, password: string): Promise<any> {
    try {
      // Sign in with Supabase
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        this.logger.warn(`Login failed for ${email}: ${error?.message}`);
        throw new UnauthorizedException('Invalid email or password');
      }

      // Get or sync user from MongoDB
      let mongoUser = await this.usersService.findBySupabaseId(data.user.id);

      if (!mongoUser) {
        // If user doesn't exist in MongoDB, sync it
        mongoUser = await this.usersService.syncWithSupabase(data.user);
      }

      // Update last login
      if (mongoUser._id) {
        await this.usersService.updateLastLogin(mongoUser._id.toString());
      }

      this.logger.log(`User logged in: ${mongoUser.username} (${mongoUser.email})`);

      // Return the Supabase token and user info
      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: 'Bearer',
        expires_in: data.session.expires_in || 3600,
        user: {
          id: mongoUser._id?.toString(),
          email: mongoUser.email,
          role: mongoUser.role || 'user',
          username: mongoUser.username,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Login error:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<any> {
    try {
      // Refresh the session with Supabase
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session || !data.user) {
        this.logger.warn(`Token refresh failed: ${error?.message}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user from MongoDB
      const mongoUser = await this.usersService.findBySupabaseId(data.user.id);

      if (!mongoUser) {
        throw new UnauthorizedException('User not found');
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: 'Bearer',
        expires_in: data.session.expires_in || 3600,
        user: {
          id: mongoUser._id?.toString(),
          email: mongoUser.email,
          role: mongoUser.role || 'user',
          username: mongoUser.username,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Token refresh error:', error);
      throw new UnauthorizedException('Token refresh failed');
    }
  }
}
