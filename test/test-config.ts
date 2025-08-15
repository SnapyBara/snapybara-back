// Mock implementations for testing
export const mockSupabaseClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { username: 'testuser' },
        },
      },
      error: null,
    }),
    signUp: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    }),
    signIn: jest.fn().mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    }),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  update: jest.fn().mockResolvedValue({ data: null, error: null }),
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn().mockResolvedValue({ data: null, error: null }),
    getPublicUrl: jest
      .fn()
      .mockReturnValue({ data: { publicUrl: 'https://test.url' } }),
  },
  realtime: {},
};

export const mockSupabaseService = {
  client: mockSupabaseClient,
  getClient: jest.fn().mockReturnValue(mockSupabaseClient),
  getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
  getUserByEmail: jest.fn().mockResolvedValue({ data: null, error: null }),
  updateUserProfile: jest.fn().mockResolvedValue({ data: null, error: null }),
  createUserProfile: jest.fn().mockResolvedValue({ data: null, error: null }),
  getUser: jest.fn().mockResolvedValue({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
    },
    error: null,
  }),
  db: mockSupabaseClient,
  storage: mockSupabaseClient.storage,
  realtime: mockSupabaseClient.realtime,
  setAuth: jest.fn().mockReturnValue(mockSupabaseClient),
};

export const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  reset: jest.fn(),
};

export const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
};

export const mockNotificationService = {
  sendNotification: jest.fn().mockResolvedValue(true),
  createNotification: jest
    .fn()
    .mockResolvedValue({ id: 'test-notification-id' }),
};

export const mockUsersService = {
  findBySupabaseId: jest.fn().mockResolvedValue({
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    supabaseId: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    profilePicture: null,
  }),
  create: jest.fn().mockResolvedValue({
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    supabaseId: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
  }),
};
