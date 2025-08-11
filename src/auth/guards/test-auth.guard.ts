import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // For tests without auth header, allow access
    if (!authHeader) {
      return true;
    }

    // For tests with auth header, set a mock user
    const token = authHeader.replace('Bearer ', '');
    if (token) {
      request.user = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {
          username: 'testuser',
        },
      };
    }

    return true;
  }
}
