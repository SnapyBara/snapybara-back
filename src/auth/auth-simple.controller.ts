import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

@Controller('auth')
export class AuthSimpleController {
  private googleClient: OAuth2Client;

  constructor() {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new Error('Missing GOOGLE_CLIENT_ID environment variable');
    }
    this.googleClient = new OAuth2Client(googleClientId);
  }

  @Post('google-simple')
  async googleAuthSimple(@Body() body: { idToken: string }) {
    try {
      const { idToken } = body;

      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
      }

      return {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        googleId: payload.sub,
        verified: true
      };

    } catch (error) {
      console.error('Google auth error:', error);
      throw new HttpException(
        'Authentication failed',
        HttpStatus.UNAUTHORIZED
      );
    }
  }
}
