import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

interface SignUpResponse {
  user: User | null;
  session: any;
}

interface SignInResponse {
  user: User | null;
  session: any;
}

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async signUp(email: string, password: string): Promise<SignUpResponse> {
    const { data, error } = await this.supabaseService.signUp(email, password);

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async signIn(email: string, password: string): Promise<SignInResponse> {
    const { data, error } = await this.supabaseService.signIn(email, password);

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async signOut(): Promise<{ message: string }> {
    const { error } = await this.supabaseService.signOut();

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return { message: 'Successfully signed out' };
  }

  async getCurrentUser(accessToken: string): Promise<User | null> {
    const {
      data: { user },
      error,
    } = await this.supabaseService.getUser(accessToken);

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return user;
  }

  async refreshToken(refreshToken: string): Promise<SignInResponse> {
    const { data, error } =
      await this.supabaseService.refreshSession(refreshToken);

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async resetPassword(email: string): Promise<{ message: string }> {
    const { error } = await this.supabaseService.resetPasswordForEmail(email);

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return { message: 'Password reset email sent' };
  }
}
