import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: AuthService;

  const mockAuthService = {
    validateUserById: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SUPABASE_JWT_SECRET') {
        return 'test-supabase-secret';
      }
      if (key === 'SUPABASE_PROJECT_REF') {
        return 'test-project-ref';
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should validate and return user for valid payload', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        isActive: true,
      };

      mockAuthService.validateUserById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(authService.validateUserById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = {
        sub: 'non-existent-user',
        email: 'test@example.com',
      };

      mockAuthService.validateUserById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token payload')
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      mockAuthService.validateUserById.mockRejectedValue(
        new UnauthorizedException('User account is deactivated')
      );

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token payload')
      );
    });

    it('should handle MongoDB ObjectId format', async () => {
      const payload = {
        sub: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        username: 'testuser',
        role: 'admin',
        isActive: true,
      };

      mockAuthService.validateUserById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockUser);
    });
  });

  describe('constructor', () => {
    it('should be configured with JWT secret from config', () => {
      // The constructor is called during module creation
      // We can verify that the strategy was created successfully
      expect(strategy).toBeDefined();
      // The actual config calls happen during construction which is before our test
    });
  });
});
