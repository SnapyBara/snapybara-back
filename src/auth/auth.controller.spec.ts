import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let usersService: UsersService;

  const mockAuthService = {
    loginWithSupabase: jest.fn(),
    refreshToken: jest.fn(),
    validateSupabaseToken: jest.fn(),
    generateSupabaseCompatibleToken: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
    findBySupabaseId: jest.fn(),
    syncWithSupabase: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    supabaseId: 'test-supabase-id',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
    level: 1,
    points: 0,
    profilePicture: null,
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockSupabaseUser = {
    id: 'test-supabase-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login a user', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const loginResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockSupabaseUser,
      };

      mockAuthService.loginWithSupabase.mockResolvedValue(loginResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(loginResponse);
      expect(authService.loginWithSupabase).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
    });

    it('should throw unauthorized exception on invalid credentials', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockAuthService.loginWithSupabase.mockRejectedValue(
        new Error('Invalid credentials'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(
        new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED),
      );
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const refreshDto: RefreshTokenDto = {
        refresh_token: 'mock-refresh-token',
      };

      const refreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockSupabaseUser,
      };

      mockAuthService.refreshToken.mockResolvedValue(refreshResponse);

      const result = await controller.refreshToken(refreshDto);

      expect(result).toEqual(refreshResponse);
      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshDto.refresh_token,
      );
    });

    it('should throw unauthorized exception on invalid refresh token', async () => {
      const refreshDto: RefreshTokenDto = {
        refresh_token: 'invalid-token',
      };

      mockAuthService.refreshToken.mockRejectedValue(
        new Error('Invalid refresh token'),
      );

      await expect(controller.refreshToken(refreshDto)).rejects.toThrow(
        new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED),
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const token = 'valid-token';
      const validUser = {
        mongoId: mockUser._id,
        supabaseId: mockUser.supabaseId,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
      };

      mockAuthService.validateSupabaseToken.mockResolvedValue(validUser);

      const result = await controller.verifyToken(token);

      expect(result).toEqual({
        valid: true,
        user: {
          id: validUser.mongoId,
          supabaseId: validUser.supabaseId,
          email: validUser.email,
          username: validUser.username,
          role: validUser.role,
        },
      });
    });

    it('should return invalid for bad token', async () => {
      const token = 'invalid-token';

      mockAuthService.validateSupabaseToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      const result = await controller.verifyToken(token);

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token',
      });
    });

    it('should throw bad request if token is missing', async () => {
      await expect(controller.verifyToken('')).rejects.toThrow(
        new HttpException('Token is required', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const currentUser = {
        mongoId: mockUser._id,
        email: mockUser.email,
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getProfile(currentUser);

      expect(result).toEqual({
        id: mockUser._id,
        supabaseId: mockUser.supabaseId,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        level: mockUser.level,
        points: mockUser.points,
        profilePicture: mockUser.profilePicture,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        lastLoginAt: mockUser.lastLoginAt,
      });
      expect(usersService.findOne).toHaveBeenCalledWith(currentUser.mongoId);
    });
  });

  describe('refreshUser', () => {
    it('should refresh user data', async () => {
      const currentUser = {
        mongoId: mockUser._id,
        email: mockUser.email,
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);

      const result = await controller.refreshUser(currentUser);

      expect(result).toEqual({
        message: 'User data refreshed successfully',
        user: {
          id: mockUser._id,
          username: mockUser.username,
          email: mockUser.email,
          lastLoginAt: expect.any(Date),
        },
      });
      expect(usersService.updateLastLogin).toHaveBeenCalledWith(
        currentUser.mongoId,
      );
    });
  });

  describe('googleAuth', () => {
    it('should throw service unavailable if Google auth not configured', async () => {
      const googleAuthDto: GoogleAuthDto = {
        idToken: 'google-id-token',
      };

      await expect(controller.googleAuth(googleAuthDto)).rejects.toThrow(
        new HttpException(
          'Google authentication is not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );
    });
  });

  describe('test', () => {
    it('should return test endpoint information', async () => {
      const result = await controller.test();

      expect(result).toEqual({
        message: 'Auth endpoint is working',
        timestamp: expect.any(String),
        googleAuthEnabled: false,
        supabaseAdminEnabled: false,
      });
    });
  });
});
