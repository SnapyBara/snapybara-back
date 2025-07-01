import { User, Session, AuthError } from '@supabase/supabase-js';

/**
 * Utilitaires pour les tests Supabase
 */

export const createMockAuthError = (
  message: string,
  code: string = 'auth_error',
  status: number = 400,
): AuthError =>
  ({
    message,
    name: 'AuthError',
    code,
    status,
  }) as unknown as AuthError;

export const createMockUser = (overrides: Partial<User> = {}): User => ({
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
  ...overrides,
});

export const createMockSession = (user?: User): Session => ({
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  refresh_token: 'refresh-token-123',
  expires_in: 3600,
  token_type: 'bearer',
  user: user ?? createMockUser(),
});

export const SupabaseErrorCodes = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  EMAIL_NOT_CONFIRMED: 'email_not_confirmed',
  TOO_MANY_REQUESTS: 'too_many_requests',
  SIGNUP_DISABLED: 'signup_disabled',
  EMAIL_ADDRESS_INVALID: 'email_address_invalid',
  PASSWORD_TOO_SHORT: 'password_too_short',
  USER_NOT_FOUND: 'user_not_found',
  TOKEN_EXPIRED: 'token_expired',
  REFRESH_TOKEN_NOT_FOUND: 'refresh_token_not_found',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  INTERNAL_ERROR: 'internal_error',
} as const;

export const createAuthErrors = {
  invalidCredentials: () =>
    createMockAuthError(
      'Invalid credentials',
      SupabaseErrorCodes.INVALID_CREDENTIALS,
    ),
  emailNotConfirmed: () =>
    createMockAuthError(
      'Email not confirmed',
      SupabaseErrorCodes.EMAIL_NOT_CONFIRMED,
    ),
  userNotFound: () =>
    createMockAuthError('User not found', SupabaseErrorCodes.USER_NOT_FOUND),
  tokenExpired: () =>
    createMockAuthError('Token expired', SupabaseErrorCodes.TOKEN_EXPIRED),
  unauthorized: () =>
    createMockAuthError('Unauthorized', SupabaseErrorCodes.UNAUTHORIZED),
  tooManyRequests: () =>
    createMockAuthError(
      'Too many requests',
      SupabaseErrorCodes.TOO_MANY_REQUESTS,
    ),
};

export interface MockSupabaseResponse<T> {
  data: T;
  error: null;
}

export interface MockSupabaseErrorResponse {
  data: null;
  error: AuthError;
}

export const createSuccessResponse = <T>(data: T): MockSupabaseResponse<T> => ({
  data,
  error: null,
});

export const createErrorResponse = (
  error: AuthError,
): MockSupabaseErrorResponse => ({
  data: null,
  error,
});

export const createMockSupabaseService = () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getUser: jest.fn(),
  refreshSession: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  client: {
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
});
