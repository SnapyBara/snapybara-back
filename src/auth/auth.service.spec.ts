import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';

// Mock data
const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: '2023-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2023-01-01T00:00:00Z',
  last_sign_in_at: '2023-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockSession: Session = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  refresh_token: 'refresh-token-123',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser,
};

interface SupabaseError {
  message: string;
  status?: number;
}

const createMockAuthError = (message: string, code?: string): AuthError => ({
  message,
  name: 'AuthError',
  code: code ?? 'auth_error',
  __isAuthError: true,
});

describe('AuthService', () => {
  let service: AuthService;
  let supabaseService: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const mockSupabaseService = {
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      refreshSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('should successfully sign up a user', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockSignUp = supabaseService.signUp;

      mockSignUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await service.signUp(email, password);

      expect(mockSignUp).toHaveBeenCalledWith(email, password);
      expect(result).toEqual({
        user: mockUser,
        session: mockSession,
      });
    });

    it('should throw UnauthorizedException on error', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockSignUp = supabaseService.signUp;

      const authError = createMockAuthError('Email already exists', 'signup_email_exists');

      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      });

      await expect(service.signUp(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('signIn', () => {
    it('should successfully sign in a user', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockSignIn = supabaseService.signIn;

      mockSignIn.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await service.signIn(email, password);

      expect(mockSignIn).toHaveBeenCalledWith(email, password);
      expect(result).toEqual({
        user: mockUser,
        session: mockSession,
      });
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const mockSignIn = supabaseService.signIn;

      const authError = createMockAuthError('Invalid credentials', 'invalid_credentials');

      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      });

      await expect(service.signIn(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('signOut', () => {
    it('should successfully sign out', async () => {
      const mockSignOut = supabaseService.signOut;
      
      mockSignOut.mockResolvedValue({ error: null });      const result = await service.signOut();

      expect(mockSignOut).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Successfully signed out' });
    });

    it('should throw UnauthorizedException on error', async () => {
      const mockSignOut = supabaseService.signOut;
      
      mockSignOut.mockResolvedValue({
        error: createAuthErrors.unauthorized(),
      });

      await expect(service.signOut()).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const token = 'jwt-token';
      const mockGetUser = supabaseService.getUser;

      mockGetUser.mockResolvedValue(
        createSuccessResponse({ user: mockUser })
      );

      const result = await service.getCurrentUser(token);

      expect(mockGetUser).toHaveBeenCalledWith(token);
      expect(result).toBe(mockUser);
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      const token = 'invalid-token';
      const mockGetUser = supabaseService.getUser;

      mockGetUser.mockResolvedValue(
        createErrorResponse(createAuthErrors.tokenExpired())
      );

      await expect(service.getCurrentUser(token)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const refreshToken = 'refresh-token';
      const mockRefreshSession = supabaseService.refreshSession;

      mockRefreshSession.mockResolvedValue(
        createSuccessResponse({ user: mockUser, session: mockSession })
      );

      const result = await service.refreshToken(refreshToken);

      expect(mockRefreshSession).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual({
        user: mockUser,
        session: mockSession,
      });
    });
  });

  describe('resetPassword', () => {
    it('should successfully send reset password email', async () => {
      const email = 'test@example.com';
      const mockResetPassword = supabaseService.resetPasswordForEmail;

      mockResetPassword.mockResolvedValue(createSuccessResponse({}));

      const result = await service.resetPassword(email);

      expect(mockResetPassword).toHaveBeenCalledWith(email);
      expect(result).toEqual({ message: 'Password reset email sent' });
    });
  });
});
