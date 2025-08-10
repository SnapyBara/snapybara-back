import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let authService: AuthService;

  const mockAuthService = {
    validateSupabaseToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
    authService = module.get<AuthService>(AuthService);
  });

  describe('canActivate', () => {
    it('should return true for public routes', async () => {
      const context = createMockExecutionContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = await guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(result).toBe(true);
    });

    it('should validate token for protected routes', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid-token',
        },
      });
      const mockUser = { id: '123', email: 'test@example.com' };
      
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockAuthService.validateSupabaseToken.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(authService.validateSupabaseToken).toHaveBeenCalledWith('valid-token');
      expect(result).toBe(true);
      
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for missing token', async () => {
      const context = createMockExecutionContext({
        headers: {},
      });
      
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('No authentication token provided')
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });
      
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockAuthService.validateSupabaseToken.mockRejectedValue(
        new Error('Invalid token')
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid authentication token')
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
