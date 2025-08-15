import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class SecurityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SecurityLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = request.user?.id || 'anonymous';

    const suspiciousPatterns = [
      /(\.\.|\/\/)/,
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /eval\(/i,
      /\$where/i,
      /\$ne/i,
    ];

    const checkSuspiciousActivity = () => {
      const queryString = JSON.stringify(request.query);
      const bodyString = JSON.stringify(request.body);

      return suspiciousPatterns.some(
        (pattern) => pattern.test(queryString) || pattern.test(bodyString),
      );
    };

    if (checkSuspiciousActivity()) {
      this.logger.warn(
        `Suspicious activity detected - IP: ${ip}, User: ${userId}, URL: ${url}`,
      );
    }

    if (method !== 'GET') {
      this.logger.log(`${method} ${url} - User: ${userId}, IP: ${ip}`);
    }

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;
          if (responseTime > 5000) {
            this.logger.warn(
              `Slow response - ${method} ${url} took ${responseTime}ms`,
            );
          }
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.logger.error(
            `${method} ${url} - Error: ${error.message}, User: ${userId}, IP: ${ip}, Time: ${responseTime}ms`,
          );

          if (error.status === 401 || error.status === 403) {
            this.logger.warn(
              `Authentication failure - User: ${userId}, IP: ${ip}`,
            );
          }
        },
      }),
    );
  }
}
