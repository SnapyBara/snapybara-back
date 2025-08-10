import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let usersService: UsersService;

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

    jest.clearAllMocks();
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
});
