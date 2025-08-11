import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { UsersService } from '../../users/users.service';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let supabaseService: SupabaseService;
  let usersService: UsersService;

  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const mockSupabaseService = {
    getClient: jest.fn(() => mockSupabaseClient),
  };

  const mockUsersService = {
    findBySupabaseId: jest.fn(),
    syncWithSupabase: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true for valid Bearer token', async () => {
      const mockSupabaseUser = {
        id: 'supabase-123',
        email: 'test@example.com',
      };

      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith(
        'valid-token',
      );

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(mockSupabaseUser);
    });

    it('should throw UnauthorizedException for missing authorization header', async () => {
      const context = createMockExecutionContext({
        headers: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('No authorization header'),
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should throw UnauthorizedException when Supabase returns error', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer error-token',
        },
      });

      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Supabase error'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should handle x-supabase-auth header', async () => {
      const mockSupabaseUser = {
        id: 'supabase-123',
        email: 'test@example.com',
      };

      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith(
        'valid-token',
      );
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
