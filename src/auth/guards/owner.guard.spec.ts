import { Test, TestingModule } from '@nestjs/testing';
import { OwnerGuard } from './owner.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('OwnerGuard', () => {
  let guard: OwnerGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OwnerGuard],
    }).compile();

    guard = module.get<OwnerGuard>(OwnerGuard);
  });

  describe('canActivate', () => {
    it('should return true if user is admin', () => {
      const context = createMockExecutionContext({
        user: { role: 'admin', mongoId: 'admin-id' },
        params: { id: 'resource-id' },
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true if user is resource owner (by id)', () => {
      const userId = '507f1f77bcf86cd799439011';
      const context = createMockExecutionContext({
        user: { role: 'user', mongoId: userId },
        params: { id: userId },
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true if user is resource owner (by supabaseId)', () => {
      const supabaseId = 'supabase-123';
      const context = createMockExecutionContext({
        user: { role: 'user', supabaseId: supabaseId },
        params: { supabaseId: supabaseId },
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if user is not owner or admin', () => {
      const context = createMockExecutionContext({
        user: { role: 'user', mongoId: 'user-123' },
        params: { id: 'different-resource-id' },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should return false if no user is authenticated', () => {
      const context = createMockExecutionContext({
        params: { id: 'resource-id' },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should handle missing params gracefully', () => {
      const context = createMockExecutionContext({
        user: { role: 'user', mongoId: 'user-123' },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
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
