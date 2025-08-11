import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseWebhookController } from './supabase-webhook.controller';
import { UsersService } from '../users/users.service';
import { Logger, HttpException, HttpStatus } from '@nestjs/common';

describe('SupabaseWebhookController', () => {
  let controller: SupabaseWebhookController;
  let usersService: UsersService;

  const mockUsersService = {
    findBySupabaseId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    syncWithSupabase: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupabaseWebhookController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<SupabaseWebhookController>(
      SupabaseWebhookController,
    );
    usersService = module.get<UsersService>(UsersService);

    // Mock Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    jest.clearAllMocks();
  });

  describe('handleSupabaseAuthEvent', () => {
    const mockUser = {
      _id: 'mongo-123',
      supabaseId: 'supabase-123',
      email: 'test@example.com',
      username: 'testuser',
    };

    const authHeader = 'Bearer valid-token';

    it('should handle user signup (INSERT on users table)', async () => {
      const payload = {
        type: 'INSERT',
        table: 'users',
        record: {
          id: 'supabase-123',
          email: 'newuser@example.com',
          raw_user_meta_data: {
            full_name: 'New User',
          },
        },
      };

      mockUsersService.syncWithSupabase.mockResolvedValue(mockUser);

      const result = await controller.handleSupabaseAuthEvent(
        payload,
        authHeader,
      );

      expect(usersService.syncWithSupabase).toHaveBeenCalledWith(
        payload.record,
      );
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });

    it('should handle user update (UPDATE on users table)', async () => {
      const payload = {
        type: 'UPDATE',
        table: 'users',
        record: {
          id: 'supabase-123',
          email: 'updated@example.com',
          raw_user_meta_data: {
            full_name: 'Updated User',
          },
        },
      };

      mockUsersService.syncWithSupabase.mockResolvedValue(mockUser);

      const result = await controller.handleSupabaseAuthEvent(
        payload,
        authHeader,
      );

      expect(usersService.syncWithSupabase).toHaveBeenCalledWith(
        payload.record,
      );
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });

    it('should handle unknown event type', async () => {
      const payload = {
        type: 'DELETE',
        table: 'users',
        record: {},
      };

      const result = await controller.handleSupabaseAuthEvent(
        payload,
        authHeader,
      );

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Unhandled webhook type: DELETE',
      );
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });

    it('should throw unauthorized exception without auth header', async () => {
      const payload = {
        type: 'INSERT',
        table: 'users',
        record: {},
      };

      await expect(
        controller.handleSupabaseAuthEvent(payload, undefined),
      ).rejects.toThrow(
        new HttpException('Unauthorized webhook', HttpStatus.UNAUTHORIZED),
      );
    });

    it('should throw unauthorized exception with invalid auth header', async () => {
      const payload = {
        type: 'INSERT',
        table: 'users',
        record: {},
      };

      await expect(
        controller.handleSupabaseAuthEvent(payload, 'Invalid token'),
      ).rejects.toThrow(
        new HttpException('Unauthorized webhook', HttpStatus.UNAUTHORIZED),
      );
    });

    it('should handle errors gracefully', async () => {
      const payload = {
        type: 'INSERT',
        table: 'users',
        record: {
          id: 'supabase-123',
          email: 'error@example.com',
        },
      };

      mockUsersService.syncWithSupabase.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await controller.handleSupabaseAuthEvent(
        payload,
        authHeader,
      );

      expect(Logger.prototype.error).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });

    it('should ignore non-user table events', async () => {
      const payload = {
        type: 'INSERT',
        table: 'profiles',
        record: { id: '123' },
      };

      const result = await controller.handleSupabaseAuthEvent(
        payload,
        authHeader,
      );

      expect(usersService.syncWithSupabase).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });
  });
});
