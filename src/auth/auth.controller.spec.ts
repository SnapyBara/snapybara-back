import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { HttpException, HttpStatus } from '@nestjs/common';

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

    // Reset environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login user with Supabase', async () => {
      const loginDto = { email: 'test@example.com', password: 'password123' };
      const mockResult = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: {
          id: '123',
          email: 'test@example.com',
        },
      };

      mockAuthService.loginWithSupabase.mockResolvedValue(mockResult);

      const result = await controller.login(loginDto);

      expect(authService.loginWithSupabase).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on login failure', async () => {
      const loginDto = { email: 'test@example.com', password: 'wrong' };

      mockAuthService.loginWithSupabase.mockRejectedValue(
        new Error('Invalid credentials'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(HttpException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token', async () => {
      const refreshDto = { refresh_token: 'old-refresh-token' };
      const mockResult = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        user: {
          id: '123',
          email: 'test@example.com',
        },
      };

      mockAuthService.refreshToken.mockResolvedValue(mockResult);

      const result = await controller.refreshToken(refreshDto);

      expect(authService.refreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on refresh failure', async () => {
      const refreshDto = { refresh_token: 'invalid-token' };

      mockAuthService.refreshToken.mockRejectedValue(
        new Error('Invalid refresh token'),
      );

      await expect(controller.refreshToken(refreshDto)).rejects.toThrow(HttpException);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const token = 'valid-token';
      const mockUser = {
        mongoId: 'mongo-123',
        supabaseId: 'supabase-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      };

      mockAuthService.validateSupabaseToken.mockResolvedValue(mockUser);

      const result = await controller.verifyToken(token);

      expect(authService.validateSupabaseToken).toHaveBeenCalledWith(token);
      expect(result).toEqual({
        valid: true,
        user: {
          id: mockUser.mongoId,
          supabaseId: mockUser.supabaseId,
          email: mockUser.email,
          username: mockUser.username,
          role: mockUser.role,
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

    it('should throw HttpException if token not provided', async () => {
      await expect(controller.verifyToken('')).rejects.toThrow(
        new HttpException('Token is required', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const currentUser = { mongoId: 'mongo-123' };
      const mockUser = {
        _id: 'mongo-123',
        supabaseId: 'supabase-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        level: 1,
        points: 100,
        profilePicture: 'https://example.com/pic.jpg',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getProfile(currentUser);

      expect(usersService.findOne).toHaveBeenCalledWith('mongo-123');
      expect(result).toMatchObject({
        id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
      });
    });
  });

  describe('refreshUser', () => {
    it('should refresh user data', async () => {
      const currentUser = { mongoId: 'mongo-123' };
      const mockUser = {
        _id: 'mongo-123',
        username: 'testuser',
        email: 'test@example.com',
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);

      const result = await controller.refreshUser(currentUser);

      expect(usersService.findOne).toHaveBeenCalledWith('mongo-123');
      expect(usersService.updateLastLogin).toHaveBeenCalledWith('mongo-123');
      expect(result).toMatchObject({
        message: 'User data refreshed successfully',
        user: {
          id: mockUser._id,
          username: mockUser.username,
          email: mockUser.email,
        },
      });
    });
  });

  describe('googleAuth', () => {
    let mockGoogleVerify: jest.Mock;
    let mockSupabaseAdmin: any;

    beforeEach(() => {
      // Mock Google OAuth client
      mockGoogleVerify = jest.fn();
      (controller as any).googleClient = {
        verifyIdToken: mockGoogleVerify,
      };

      // Mock Supabase admin client
      mockSupabaseAdmin = {
        auth: {
          admin: {
            listUsers: jest.fn(),
            createUser: jest.fn(),
            generateLink: jest.fn(),
          },
        },
      };
      (controller as any).supabaseAdmin = mockSupabaseAdmin;
    });

    it('should authenticate with Google for new user', async () => {
      const googleAuthDto = { idToken: 'google-id-token' };
      const mockPayload = {
        email: 'newuser@gmail.com',
        name: 'New User',
        picture: 'https://example.com/pic.jpg',
        sub: 'google-123',
      };
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(mockPayload),
      };

      mockGoogleVerify.mockResolvedValue(mockTicket);
      mockSupabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
      });
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: 'supabase-new-123',
            email: mockPayload.email,
            created_at: new Date().toISOString(),
          },
        },
      });
      mockSupabaseAdmin.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            hashed_token: 'some-hashed-token',
          },
        },
        error: null,
      });
      mockUsersService.findBySupabaseId.mockResolvedValue(null);
      mockUsersService.syncWithSupabase.mockResolvedValue({
        _id: 'mongo-new-123',
      });
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateSupabaseCompatibleToken.mockResolvedValue({
        access_token: 'generated-access-token',
        refresh_token: 'generated-refresh-token',
      });

      const result = await controller.googleAuth(googleAuthDto);

      expect(mockGoogleVerify).toHaveBeenCalled();
      expect(mockSupabaseAdmin.auth.admin.createUser).toHaveBeenCalled();
      expect(result).toMatchObject({
        user: {
          email: mockPayload.email,
        },
        session: {
          access_token: 'generated-access-token',
          refresh_token: 'generated-refresh-token',
        },
      });
    });

    it('should authenticate with Google for existing user', async () => {
      const googleAuthDto = { idToken: 'google-id-token' };
      const mockPayload = {
        email: 'existing@gmail.com',
        name: 'Existing User',
        picture: 'https://example.com/pic.jpg',
        sub: 'google-456',
      };
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(mockPayload),
      };
      const existingSupabaseUser = {
        id: 'supabase-existing-123',
        email: mockPayload.email,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockGoogleVerify.mockResolvedValue(mockTicket);
      mockSupabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: { users: [existingSupabaseUser] },
      });
      mockSupabaseAdmin.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            hashed_token: 'some-hashed-token',
          },
        },
        error: null,
      });
      mockUsersService.findBySupabaseId.mockResolvedValue({
        _id: 'mongo-existing-123',
      });
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateSupabaseCompatibleToken.mockResolvedValue({
        access_token: 'generated-access-token',
        refresh_token: 'generated-refresh-token',
      });

      const result = await controller.googleAuth(googleAuthDto);

      expect(mockSupabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        user: {
          id: existingSupabaseUser.id,
          email: existingSupabaseUser.email,
        },
      });
    });

    it('should throw error if Google auth not configured', async () => {
      (controller as any).googleClient = null;

      await expect(
        controller.googleAuth({ idToken: 'token' }),
      ).rejects.toThrow(
        new HttpException(
          'Google authentication is not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );
    });

    it('should throw error on invalid Google token', async () => {
      const googleAuthDto = { idToken: 'invalid-token' };
      
      mockGoogleVerify.mockRejectedValue(new Error('Invalid token'));

      await expect(controller.googleAuth(googleAuthDto)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('test', () => {
    it('should return test endpoint info', async () => {
      const result = await controller.test();

      expect(result).toHaveProperty('message', 'Auth endpoint is working');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('googleAuthEnabled');
      expect(result).toHaveProperty('supabaseAdminEnabled');
    });
  });
});
