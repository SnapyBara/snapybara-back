import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const params = request.params;

    if (!user) {
      return false;
    }

    // Admin can access everything
    if (user.role === 'admin') {
      return true;
    }

    // Check if user is accessing their own data
    const resourceId = params.id || params.userId || params.supabaseId;
    
    if (resourceId && (resourceId === user.mongoId || resourceId === user.supabaseId)) {
      return true;
    }

    throw new ForbiddenException('You can only access your own resources');
  }
}
