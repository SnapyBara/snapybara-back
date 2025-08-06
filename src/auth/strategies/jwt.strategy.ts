import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const jwtSecret = configService.get<string>('SUPABASE_JWT_SECRET');
    const projectRef = configService.get<string>('SUPABASE_PROJECT_REF');

    if (!jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      issuer: projectRef
        ? `https://${projectRef}.supabase.co/auth/v1`
        : undefined,
      audience: projectRef || undefined,
    });
  }

  async validate(payload: any): Promise<any> {
    try {
      // Validate user exists and is active
      const user = await this.authService.validateUserById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token payload');
    }
  }
}
