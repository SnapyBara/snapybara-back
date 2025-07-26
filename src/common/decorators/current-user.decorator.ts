import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { User } from '@supabase/supabase-js';
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const user = gqlContext.req.user;

    if (!user) {
      throw new Error('User not found in request context');
    }

    return user;
  },
);

export const CurrentUserRest = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new Error('User not found in request context');
    }

    return user;
  },
);
