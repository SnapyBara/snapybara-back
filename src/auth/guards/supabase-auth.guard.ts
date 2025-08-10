import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;


    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted:', token.substring(0, 20) + '...');

    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.getClient().auth.getUser(token);

      console.log('Supabase response - User:', user);
      console.log('Supabase response - Error:', error);

      if (error || !user) {
        console.error('Supabase validation failed:', error);
        throw new UnauthorizedException('Invalid token');
      }

      request.user = user;
      console.log('User authenticated:', user.email);
      return true;
    } catch (error) {
      console.error('Supabase authentication error:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
