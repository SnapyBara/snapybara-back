import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        Sentry.setContext('request', {
          url: request.url,
          method: request.method,
          headers: request.headers,
          query: request.query,
          body: request.body,
        });

        if (user) {
          Sentry.setUser({
            id: user.sub || user.id,
            email: user.email,
          });
        }

        const isHttpError = error instanceof HttpException;
        const status = isHttpError ? error.getStatus() : 500;
        
        if (!isHttpError || status >= 500) {
          Sentry.captureException(error, {
            tags: {
              section: 'api',
              endpoint: request.url,
            },
            level: status >= 500 ? 'error' : 'warning',
          });
        }

        Sentry.setUser(null);

        return throwError(() => error);
      }),
    );
  }
}
