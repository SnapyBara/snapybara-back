import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '../config/env.validation';
import { SupabaseService } from '../supabase/supabase.service';

interface JwtPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.supabaseJwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<any> {
    if (!payload.sub) {
      return null;
    }
    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.getUser();
      if (error || !user) {
        return null;
      }
      return user;
    } catch (_error) {
      return null;
    }
  }
}
