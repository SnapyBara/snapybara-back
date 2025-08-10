import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('canActivate', () => {
    it('should return true if no roles are required', () => {
      const context = createMockExecutionContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true if user has required role', () => {
      const context = createMockExecutionContext({
        user: { role: 'admin' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return false if user does not have required role', () => {
      const context = createMockExecutionContext({
        user: { role: 'user' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return false if user is not authenticated', () => {
      const context = createMockExecutionContext({});
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should handle multiple required roles', () => {
      const context = createMockExecutionContext({
        user: { role: 'moderator' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'moderator']);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});

function createMockExecutionContext(request?: any): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request || {}),
    }),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as any;
}
