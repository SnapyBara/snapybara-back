import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseWebhookController } from './supabase-webhook.controller';
import { UsersService } from '../users/users.service';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

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

  const WEBHOOK_SECRET = 'test-webhook-secret';
  const sign = (payload: any) =>
    crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payload ?? {}))
      .digest('hex');

  beforeEach(async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NODE_ENV = 'test'; // Définir l'environnement comme test (pas production)
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

    it('should handle user signup (INSERT on users table)', async () => {
      const payload = {
        type: 'INSERT',
        table: 'users',
        record: {
          id: 'supabase-123',
          email: 'newuser@example.com',
          raw_user_meta_data: { full_name: 'New User' },
        },
      };
      mockUsersService.syncWithSupabase.mockResolvedValue(mockUser);
      const result = await controller.handleSupabaseAuthEvent(
        payload,
        sign(payload),
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
          raw_user_meta_data: { full_name: 'Updated User' },
        },
      };
      mockUsersService.syncWithSupabase.mockResolvedValue(mockUser);
      const result = await controller.handleSupabaseAuthEvent(
        payload,
        sign(payload),
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
      const payload = { type: 'UNKNOWN', table: 'users', record: {} };
      const result = await controller.handleSupabaseAuthEvent(
        payload,
        sign(payload),
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Unhandled webhook type: UNKNOWN',
      );
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });

    it('should not throw but log warning without auth header in development', async () => {
      process.env.NODE_ENV = 'development';
      const payload = { type: 'INSERT', table: 'users', record: {} };
      const result = await controller.handleSupabaseAuthEvent(
        payload,
        undefined,
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Missing webhook signature but secret is configured',
      );
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });

    it('should not throw but log warning with invalid auth header in development', async () => {
      process.env.NODE_ENV = 'development';
      const payload = { type: 'INSERT', table: 'users', record: {} };
      const result = await controller.handleSupabaseAuthEvent(
        payload,
        'invalid-signature',
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Invalid webhook signature',
      );
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });

    it('should throw unauthorized exception without auth header in production', async () => {
      process.env.NODE_ENV = 'production';
      const payload = { type: 'INSERT', table: 'users', record: {} };
      await expect(
        controller.handleSupabaseAuthEvent(payload, undefined),
      ).rejects.toThrow('Missing webhook signature');
    });

    it('should throw unauthorized exception with invalid auth header in production', async () => {
      process.env.NODE_ENV = 'production';
      const payload = { type: 'INSERT', table: 'users', record: {} };
      await expect(
        controller.handleSupabaseAuthEvent(payload, 'invalid-signature'),
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should handle errors gracefully', async () => {
      const payload = {
        type: 'INSERT',
        table: 'users',
        record: { id: 'supabase-123', email: 'error@example.com' },
      };
      mockUsersService.syncWithSupabase.mockRejectedValue(
        new Error('Database error'),
      );
      const result = await controller.handleSupabaseAuthEvent(
        payload,
        sign(payload),
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
        sign(payload),
      );
      expect(usersService.syncWithSupabase).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
    });
  });

  describe('testWebhook', () => {
    it('reports the webhook configuration', async () => {
      await expect(controller.testWebhook()).resolves.toMatchObject({
        status: 'ok',
        configuration: { secretConfigured: true, environment: 'test' },
      });
    });
  });

  describe('without webhook secret', () => {
    beforeEach(() => {
      delete process.env.SUPABASE_WEBHOOK_SECRET;
    });

    it('processes the event without verifying the signature', async () => {
      const payload = { type: 'INSERT', table: 'users', record: { id: 'u1' } };

      await expect(
        controller.handleSupabaseAuthEvent(payload, undefined),
      ).resolves.toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
      expect(mockUsersService.syncWithSupabase).toHaveBeenCalledWith(
        payload.record,
      );
    });

    it('logs an error when a signature is sent in production', async () => {
      process.env.NODE_ENV = 'production';

      await controller.handleSupabaseAuthEvent(
        { type: 'UNKNOWN' },
        'some-signature',
      );

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Webhook signature provided but no secret configured to verify it',
      );
    });
  });

  describe('user events', () => {
    it('syncs the user on UPDATE', async () => {
      const payload = {
        type: 'UPDATE',
        table: 'auth.users',
        record: { id: 'u1', email: 'a@b.c' },
      };
      mockUsersService.syncWithSupabase.mockResolvedValue({ username: 'a' });

      await controller.handleSupabaseAuthEvent(payload, sign(payload));

      expect(mockUsersService.syncWithSupabase).toHaveBeenCalledWith(
        payload.record,
      );
    });

    it('logs when the UPDATE sync fails', async () => {
      const payload = {
        type: 'UPDATE',
        table: 'users',
        record: { id: 'u1', email: 'a@b.c' },
      };
      mockUsersService.syncWithSupabase.mockRejectedValue(new Error('db'));

      await expect(
        controller.handleSupabaseAuthEvent(payload, sign(payload)),
      ).resolves.toMatchObject({ success: true });
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('logs when the INSERT sync fails', async () => {
      const payload = {
        type: 'INSERT',
        table: 'users',
        record: { id: 'u1', email: 'a@b.c' },
      };
      mockUsersService.syncWithSupabase.mockRejectedValue(new Error('db'));

      await expect(
        controller.handleSupabaseAuthEvent(payload, sign(payload)),
      ).resolves.toMatchObject({ success: true });
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('soft deletes the user on DELETE', async () => {
      const payload = {
        type: 'DELETE',
        table: 'auth.users',
        old_record: { id: 'u1', email: 'a@b.c' },
      };
      const mongoUser = { isActive: true, save: jest.fn() };
      mockUsersService.findBySupabaseId.mockResolvedValue(mongoUser);

      await controller.handleSupabaseAuthEvent(payload, sign(payload));

      expect(mongoUser.isActive).toBe(false);
      expect(mongoUser.save).toHaveBeenCalled();
    });

    it('ignores DELETE for an unknown user', async () => {
      const payload = {
        type: 'DELETE',
        table: 'users',
        old_record: { id: 'u1' },
      };
      mockUsersService.findBySupabaseId.mockResolvedValue(null);

      await expect(
        controller.handleSupabaseAuthEvent(payload, sign(payload)),
      ).resolves.toMatchObject({ success: true });
    });

    it('logs when the DELETE fails', async () => {
      const payload = {
        type: 'DELETE',
        table: 'users',
        old_record: { id: 'u1' },
      };
      mockUsersService.findBySupabaseId.mockRejectedValue(new Error('db'));

      await expect(
        controller.handleSupabaseAuthEvent(payload, sign(payload)),
      ).resolves.toMatchObject({ success: true });
      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });
});
