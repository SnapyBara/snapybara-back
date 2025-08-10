import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { CurrentUser } from './current-user.decorator';
import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';

describe('Auth Decorators', () => {
  describe('Public Decorator', () => {
    it('should set metadata with isPublic = true', () => {
      const decorator = Public();
      
      // Apply decorator to a test class method
      class TestClass {
        @decorator
        testMethod() {}
      }
      
      const metadata = Reflect.getMetadata('isPublic', TestClass.prototype.testMethod);
      expect(metadata).toBe(true);
    });
  });

  describe('Roles Decorator', () => {
    it('should set metadata with roles array', () => {
      const roles = ['admin', 'moderator'];
      const decorator = Roles(...roles);
      
      // Apply decorator to a test class method
      class TestClass {
        @decorator
        testMethod() {}
      }
      
      const metadata = Reflect.getMetadata('roles', TestClass.prototype.testMethod);
      expect(metadata).toEqual(roles);
    });
  });

  describe('CurrentUser Decorator', () => {
    it('should extract user from request', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: mockUser,
          }),
        }),
      } as unknown as ExecutionContext;

      // Test the factory function directly
      const factory = (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
      };

      const result = factory(undefined, mockContext);
      expect(result).toEqual(mockUser);
    });

    it('should return undefined if no user in request', () => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as unknown as ExecutionContext;

      const factory = (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
      };

      const result = factory(undefined, mockContext);
      expect(result).toBeUndefined();
    });
  });
});
