import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class SsrfGuard implements CanActivate {
  private readonly allowedDomains = [
    'maps.googleapis.com',
    'overpass-api.de',
    'nominatim.openstreetmap.org',
    'api.unsplash.com',
    'commons.wikimedia.org',
  ];

  private readonly blockedIPs = [
    '127.0.0.1',
    'localhost',
    '0.0.0.0',
    '169.254.169.254',
  ];

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const url = request.body?.url || request.query?.url;

    if (!url) {
      return true;
    }

    try {
      const parsedUrl = new URL(url);

      if (this.blockedIPs.some((ip) => parsedUrl.hostname.includes(ip))) {
        throw new BadRequestException(
          'Invalid URL: Internal addresses not allowed',
        );
      }

      if (
        !this.allowedDomains.some((domain) =>
          parsedUrl.hostname.includes(domain),
        )
      ) {
        throw new BadRequestException('Invalid URL: Domain not allowed');
      }

      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid URL format');
    }
  }
}
