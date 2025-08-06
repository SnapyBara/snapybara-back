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
}
