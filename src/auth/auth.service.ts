import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SupabaseSimpleService } from '../supabase/supabase-simple.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private supabaseService: SupabaseSimpleService) {}

  async getProfile(accessToken: string) {
    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.getUser(accessToken);

      if (error) {
        this.logger.error('Error getting user profile:', error);
        throw new UnauthorizedException('Invalid token');
      }

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        id: user.id,
        email: user.email ?? '',
        full_name: user.user_metadata?.full_name ?? '',
        avatar_url: user.user_metadata?.avatar_url ?? '',
        email_verified: !!user.email_confirmed_at,
        provider: user.app_metadata?.provider ?? 'email',
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error) {
      this.logger.error('Get profile service error:', error);
      throw error;
    }
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.getUser(accessToken);
      return !error && !!user;
    } catch (error) {
      this.logger.error('Token validation error:', error);
      return false;
    }
  }
}
