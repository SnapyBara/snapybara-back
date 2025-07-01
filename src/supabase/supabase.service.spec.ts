import { Test, TestingModule } from '@nestjs/testing';
import { User, Session } from '@supabase/supabase-js';
import { SupabaseService, SUPABASE_MODULE_OPTIONS } from './supabase.service';
import { SupabaseModuleOptions } from './interfaces/supabase-module-options.interface';

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

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    refreshSession: jest.fn(),
    resetPasswordForEmail: jest.fn(),
  },
  storage: {},
  realtime: {},
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('SupabaseService', () => {
  let service: SupabaseService;
  let moduleOptions: SupabaseModuleOptions;

  beforeEach(async () => {
    moduleOptions = {
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      supabaseOptions: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: SUPABASE_MODULE_OPTIONS,
          useValue: moduleOptions,
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return supabase client', () => {
    expect(service.client).toBe(mockSupabaseClient);
  });

  describe('signUp', () => {
    it('should call supabase auth signUp', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockResponse = {
        data: { user: mockUser, session: mockSession },
        error: null,
      };

      mockSupabaseClient.auth.signUp.mockResolvedValue(mockResponse);

      const result = await service.signUp(email, password);

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email,
        password,
      });
      expect(result).toBe(mockResponse);
    });
  });

  describe('signIn', () => {
    it('should call supabase auth signInWithPassword', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockResponse = {
        data: { user: mockUser, session: mockSession },
        error: null,
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(
        mockResponse,
      );

      const result = await service.signIn(email, password);

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email,
        password,
      });
      expect(result).toBe(mockResponse);
    });
  });

  describe('signOut', () => {
    it('should call supabase auth signOut', async () => {
      const mockResponse = { error: null };

      mockSupabaseClient.auth.signOut.mockResolvedValue(mockResponse);

      const result = await service.signOut();

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(result).toBe(mockResponse);
    });
  });

  describe('getUser', () => {
    it('should call supabase auth getUser', async () => {
      const token = 'jwt-token';
      const mockResponse = { data: { user: mockUser }, error: null };

      mockSupabaseClient.auth.getUser.mockResolvedValue(mockResponse);

      const result = await service.getUser(token);

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith(token);
      expect(result).toBe(mockResponse);
    });
  });

  describe('refreshSession', () => {
    it('should call supabase auth refreshSession', async () => {
      const refreshToken = 'refresh-token';
      const mockResponse = {
        data: { user: mockUser, session: mockSession },
        error: null,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue(mockResponse);

      const result = await service.refreshSession(refreshToken);

      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: refreshToken,
      });
      expect(result).toBe(mockResponse);
    });
  });

  describe('resetPasswordForEmail', () => {
    it('should call supabase auth resetPasswordForEmail', async () => {
      const email = 'test@example.com';
      const mockResponse = { data: {}, error: null };

      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue(
        mockResponse,
      );

      const result = await service.resetPasswordForEmail(email);

      expect(
        mockSupabaseClient.auth.resetPasswordForEmail,
      ).toHaveBeenCalledWith(email);
      expect(result).toBe(mockResponse);
    });
  });

  describe('setAuth', () => {
    it('should create new client with auth header', () => {
      const token = 'jwt-token';

      const clientWithAuth = service.setAuth(token);

      expect(clientWithAuth).toBeDefined();
    });
  });
});
