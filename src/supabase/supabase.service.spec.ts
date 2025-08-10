import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService, SUPABASE_MODULE_OPTIONS } from './supabase.service';
import { createClient } from '@supabase/supabase-js';

// Mock
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
      insert: jest.fn(),
    })),
    storage: {},
    realtime: {},
  })),
}));

describe('SupabaseService', () => {
  let service: SupabaseService;
  let mockSupabaseClient: any;

  const mockOptions = {
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key',
    supabaseServiceKey: 'test-service-key',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: SUPABASE_MODULE_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
    mockSupabaseClient = (createClient as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service with proper configuration', () => {
      expect(createClient).toHaveBeenCalledTimes(2);
      expect(createClient).toHaveBeenCalledWith(
        mockOptions.supabaseUrl,
        mockOptions.supabaseKey,
        {}
      );
      expect(createClient).toHaveBeenCalledWith(
        mockOptions.supabaseUrl,
        mockOptions.supabaseServiceKey,
        {}
      );
    });
  });

  describe('getClient', () => {
    it('should return supabase client', () => {
      const client = service.getClient();
      expect(client).toBeDefined();
      expect(client).toHaveProperty('auth');
      expect(client).toHaveProperty('from');
    });
  });

  describe('getAdminClient', () => {
    it('should return admin supabase client', () => {
      const adminClient = service.getAdminClient();
      expect(adminClient).toBeDefined();
      expect(adminClient).toHaveProperty('auth');
      expect(adminClient).toHaveProperty('from');
    });
  });

  describe('getUserByEmail', () => {
    it('should fetch user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockResponse = { data: mockUser, error: null };
      const singleMock = jest.fn().mockResolvedValue(mockResponse);
      const eqMock = jest.fn().mockReturnValue({ single: singleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      const fromMock = jest.fn().mockReturnValue({ select: selectMock });

      mockSupabaseClient.from = fromMock;

      const result = await service.getUserByEmail('test@example.com');

      expect(fromMock).toHaveBeenCalledWith('profiles');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('email', 'test@example.com');
      expect(singleMock).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      const userId = 'user-123';
      const updates = { first_name: 'John', last_name: 'Doe' };
      const mockResponse = { data: updates, error: null };

      const eqMock = jest.fn().mockResolvedValue(mockResponse);
      const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
      const fromMock = jest.fn().mockReturnValue({ update: updateMock });

      mockSupabaseClient.from = fromMock;

      const result = await service.updateUserProfile(userId, updates);

      expect(fromMock).toHaveBeenCalledWith('profiles');
      expect(updateMock).toHaveBeenCalledWith(updates);
      expect(eqMock).toHaveBeenCalledWith('id', userId);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createUserProfile', () => {
    it('should create user profile', async () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
      };
      const mockResponse = { data: userData, error: null };

      const insertMock = jest.fn().mockResolvedValue(mockResponse);
      const fromMock = jest.fn().mockReturnValue({ insert: insertMock });

      mockSupabaseClient.from = fromMock;

      const result = await service.createUserProfile(userData);

      expect(fromMock).toHaveBeenCalledWith('profiles');
      expect(insertMock).toHaveBeenCalledWith([userData]);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUser', () => {
    it('should get user with optional JWT', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockResponse = { data: { user: mockUser }, error: null };

      mockSupabaseClient.auth.getUser.mockResolvedValue(mockResponse);

      const result = await service.getUser('test-jwt');

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith('test-jwt');
      expect(result).toEqual(mockResponse);
    });

    it('should get user without JWT', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockResponse = { data: { user: mockUser }, error: null };

      mockSupabaseClient.auth.getUser.mockResolvedValue(mockResponse);

      const result = await service.getUser();

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('properties', () => {
    it('should expose db property', () => {
      expect(service.db).toBeDefined();
      expect(service.db).toHaveProperty('from');
    });

    it('should expose storage property', () => {
      expect(service.storage).toBeDefined();
    });

    it('should expose realtime property', () => {
      expect(service.realtime).toBeDefined();
    });

    it('should expose client property', () => {
      expect(service.client).toBeDefined();
      expect(service.client).toHaveProperty('auth');
    });
  });

  describe('setAuth', () => {
    it('should create new client with auth token', () => {
      const token = 'test-token';
      
      service.setAuth(token);

      expect(createClient).toHaveBeenCalledWith(
        mockOptions.supabaseUrl,
        mockOptions.supabaseKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );
    });
  });
});
