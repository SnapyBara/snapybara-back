import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (!request.session.csrfToken) {
        request.session.csrfToken = crypto.randomBytes(32).toString('hex');
      }
      return true;
    }

    const token = request.headers['x-csrf-token'] || request.body._csrf;
    const sessionToken = request.session.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
