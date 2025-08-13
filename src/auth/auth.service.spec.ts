import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';

// Mock Supabase module
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      refreshSession: jest.fn(),
    },
  })),
}));

import { createClient } from '@supabase/supabase-js';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let usersService: UsersService;
  let mockSupabaseClient: any;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_JWT_SECRET: 'test-secret',
      };
      return config[key];
    }),
  };

  const mockUsersService = {
    findBySupabaseId: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    syncWithSupabase: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSupabaseClient = (createClient as jest.Mock).mock.results[0]?.value || {
      auth: {
        getUser: jest.fn(),
        signInWithPassword: jest.fn(),
        refreshSession: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);

    // Get the mocked supabase client after service instantiation
    mockSupabaseClient = (service as any).supabase;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should validate user with email', async () => {
      const email = 'test@example.com';

      const result = await service.validateUser(email);

      expect(result).toEqual({ email });
    });
  });

  describe('generateToken', () => {
    it('should generate a token', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const mockToken = 'generated-token';

      mockJwtService.sign.mockReturnValueOnce(mockToken);

      const result = await service.generateToken(user);

      expect(result).toEqual({
        access_token: mockToken,
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: user.email,
        sub: user.id,
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const token = 'valid-token';
      const mockPayload = { sub: 'user-123', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValueOnce(mockPayload);

      const result = await service.verifyToken(token);

      expect(result).toEqual(mockPayload);
      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
    });

    it('should return null for invalid token', async () => {
      const token = 'invalid-token';

      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const result = await service.verifyToken(token);

      expect(result).toBeNull();
    });
  });

  describe('validateSupabaseToken', () => {
    it('should validate a Supabase token', async () => {
      const token = 'supabase-token';
      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com',
      };
      const mockMongoUser = {
        _id: 'mongo-123',
        supabaseId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        username: 'testuser',
        isActive: true,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockSupabaseUser },
        error: null,
      });
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockMongoUser);
      mockUsersService.updateLastLogin.mockResolvedValueOnce(undefined);

      const result = await service.validateSupabaseToken(token);

      expect(result).toEqual({
        mongoId: mockMongoUser._id,
        supabaseId: mockMongoUser.supabaseId,
        email: mockMongoUser.email,
        username: mockMongoUser.username,
        role: mockMongoUser.role,
        isActive: mockMongoUser.isActive,
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const token = 'invalid-token';

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(service.validateSupabaseToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should sync with MongoDB if user not found', async () => {
      const token = 'supabase-token';
      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com',
      };
      const mockNewUser = {
        _id: 'new-mongo-123',
        supabaseId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        username: 'testuser',
        isActive: true,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: mockSupabaseUser },
        error: null,
      });
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(null);
      mockUsersService.syncWithSupabase.mockResolvedValueOnce(mockNewUser);
      mockUsersService.updateLastLogin.mockResolvedValueOnce(undefined);

      const result = await service.validateSupabaseToken(token);

      expect(mockUsersService.syncWithSupabase).toHaveBeenCalledWith(
        mockSupabaseUser,
      );
      expect(result.mongoId).toBe(mockNewUser._id);
    });
  });

  describe('loginWithSupabase', () => {
    it('should login with Supabase', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockSupabaseResponse = {
        data: {
          user: {
            id: 'user-123',
            email,
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      };
      const mockMongoUser = {
        _id: 'mongo-123',
        supabaseId: 'user-123',
        email,
        username: 'testuser',
        role: 'user',
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce(
        mockSupabaseResponse,
      );
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockMongoUser);
      mockUsersService.updateLastLogin.mockResolvedValueOnce(undefined);

      const result = await service.loginWithSupabase(email, password);

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: mockMongoUser._id,
          email: mockMongoUser.email,
          role: mockMongoUser.role,
          username: mockMongoUser.username,
        },
      });
    });

    it('should throw UnauthorizedException on login failure', async () => {
      const email = 'test@example.com';
      const password = 'wrong-password';

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(service.loginWithSupabase(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'refresh-token';
      const mockSupabaseResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      };
      const mockMongoUser = {
        _id: 'mongo-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValueOnce(
        mockSupabaseResponse,
      );
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockMongoUser);

      const result = await service.refreshToken(refreshToken);

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: mockMongoUser._id,
          email: mockMongoUser.email,
          role: mockMongoUser.role,
          username: mockMongoUser.username,
        },
      });
    });

    it('should throw UnauthorizedException on refresh failure', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockSupabaseClient.auth.refreshSession.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid refresh token' },
      });

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('generateSupabaseCompatibleToken', () => {
    it('should generate Supabase compatible tokens', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          full_name: 'Test User',
        },
      };

      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockJwtService.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const result = await service.generateSupabaseCompatibleToken(user);

      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
      });
    });
  });

  describe('validateUserById', () => {
    it('should validate user by Supabase ID', async () => {
      const supabaseId = 'user-123';
      const mockMongoUser = {
        _id: 'mongo-123',
        supabaseId,
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        isActive: true,
      };

      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockMongoUser);

      const result = await service.validateUserById(supabaseId);

      expect(result).toEqual({
        supabaseId,
        mongoId: mockMongoUser._id,
        email: mockMongoUser.email,
        username: mockMongoUser.username,
        role: mockMongoUser.role,
        isActive: mockMongoUser.isActive,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const supabaseId = 'user-123';

      mockUsersService.findBySupabaseId.mockResolvedValueOnce(null);

      await expect(service.validateUserById(supabaseId)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const supabaseId = 'user-123';
      const mockInactiveUser = {
        _id: 'mongo-123',
        supabaseId,
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        isActive: false,
      };

      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockInactiveUser);

      await expect(service.validateUserById(supabaseId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
