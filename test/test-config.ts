// Mock implementations for testing
export const mockSupabaseService = {
  getClient: jest.fn().mockReturnValue({
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
  }),
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
    _id: '507f1f77bcf86cd799439011', // MongoDB ObjectId format
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
