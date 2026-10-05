import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  const mongoId = new Types.ObjectId().toString();

  const notificationsService = {
    findByUser: jest.fn(),
    create: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };
  const authService = { validateSupabaseToken: jest.fn() };
  const emit = jest.fn();
  const server = { to: jest.fn(() => ({ emit })) };

  const createClient = (
    handshake: Partial<{ headers: any; query: any }> = {},
    data: Record<string, any> = {},
  ): any => ({
    id: `socket-${Math.random()}`,
    handshake: { headers: {}, query: {}, ...handshake },
    data,
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  });

  const notificationDoc = {
    _id: new Types.ObjectId(),
    type: 'achievement_earned',
    title: 'Title',
    message: 'Message',
    data: { points: 10 },
    isRead: false,
    createdAt: new Date(),
    userId: new Types.ObjectId(mongoId),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    server.to.mockReturnValue({ emit });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: {} },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    gateway = module.get(NotificationsGateway);
    gateway.server = server as any;
    gateway.afterInit(server as any);

    authService.validateSupabaseToken.mockResolvedValue({
      mongoId,
      email: 'user@example.com',
    });
    notificationsService.findByUser.mockResolvedValue({
      data: [notificationDoc],
      unreadCount: 1,
    });
  });

  describe('handleConnection', () => {
    it.each([
      ['query', { query: { token: 'tok' } }],
      ['authorization header', { headers: { authorization: 'Bearer tok' } }],
      ['cookie', { headers: { cookie: 'foo=bar; access_token=tok' } }],
    ])('authenticates with a token from %s', async (_source, handshake) => {
      const client = createClient(handshake);

      await gateway.handleConnection(client);

      expect(authService.validateSupabaseToken).toHaveBeenCalledWith('tok');
      expect(client.data.userId).toBe(mongoId);
      expect(client.join).toHaveBeenCalledWith(`user:${mongoId}`);
      expect(client.emit).toHaveBeenCalledWith('initial_notifications', {
        notifications: [
          expect.objectContaining({
            id: notificationDoc._id.toString(),
            userId: mongoId,
          }),
        ],
        unreadCount: 1,
      });
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('tracks several sockets for the same user', async () => {
      const first = createClient({ query: { token: 'tok' } });
      const second = createClient({ query: { token: 'tok' } });

      await gateway.handleConnection(first);
      await gateway.handleConnection(second);
      gateway.handleDisconnect(first);

      expect(second.join).toHaveBeenCalledWith(`user:${mongoId}`);
    });

    it('disconnects a client without token', async () => {
      const client = createClient({ headers: { cookie: 'foo=bar' } });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(authService.validateSupabaseToken).not.toHaveBeenCalled();
    });

    it('disconnects a client with an invalid token', async () => {
      authService.validateSupabaseToken.mockRejectedValue(new Error('bad'));
      const client = createClient({ query: { token: 'bad' } });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when the token resolves to no user', async () => {
      authService.validateSupabaseToken.mockResolvedValue(null);
      const client = createClient({ query: { token: 'tok' } });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when the user has no mongo id', async () => {
      authService.validateSupabaseToken.mockResolvedValue({ email: 'x' });
      const client = createClient({ query: { token: 'tok' } });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when loading notifications fails', async () => {
      notificationsService.findByUser.mockRejectedValue(new Error('db'));
      const client = createClient({ query: { token: 'tok' } });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('ignores unauthenticated clients', () => {
      expect(() => gateway.handleDisconnect(createClient())).not.toThrow();
    });

    it('removes the last socket of a user', async () => {
      const client = createClient({ query: { token: 'tok' } });
      await gateway.handleConnection(client);

      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  describe('server notifications', () => {
    beforeEach(() => {
      notificationsService.create.mockImplementation(async (dto) => ({
        ...notificationDoc,
        ...dto,
        userId: new Types.ObjectId(dto.userId),
      }));
    });

    it('creates and emits a notification to the user room', async () => {
      await gateway.sendNotificationToUser(mongoId, {
        type: 'system',
        title: 'Hello',
        message: 'World',
      });

      expect(server.to).toHaveBeenCalledWith(`user:${mongoId}`);
      expect(emit).toHaveBeenCalledWith(
        'new_notification',
        expect.objectContaining({ type: 'system', userId: mongoId }),
      );
    });

    it('does not throw when creation fails', async () => {
      notificationsService.create.mockRejectedValue(new Error('db'));

      await expect(
        gateway.sendNotificationToUser(mongoId, {
          type: 'system',
          title: 'Hello',
          message: 'World',
        }),
      ).resolves.toBeUndefined();
      expect(emit).not.toHaveBeenCalled();
    });

    it('notifies points earned', async () => {
      await gateway.notifyPointsEarned(mongoId, 10, 'test', 110);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'achievement_earned',
          data: expect.objectContaining({ points: 10, newTotal: 110 }),
        }),
      );
    });

    it('notifies level up', async () => {
      await gateway.notifyLevelUp(mongoId, 4, ['level_5']);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Niveau 4 atteint !',
          data: expect.objectContaining({ level: 4 }),
        }),
      );
    });

    it('notifies achievement unlocked', async () => {
      await gateway.notifyAchievementUnlocked(mongoId, {
        id: 'first_photo',
        name: 'Première photo',
        description: 'desc',
        points: 10,
      });

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Première photo',
          data: expect.objectContaining({ entityType: 'achievement' }),
        }),
      );
    });
  });

  describe('client messages', () => {
    const authed = () => createClient({}, { userId: mongoId });

    it.each([
      'handleMarkAsRead',
      'handleMarkAllAsRead',
      'handleGetUnreadCount',
    ])('%s rejects unauthenticated clients', async (method) => {
      const result =
        method === 'handleMarkAsRead'
          ? await gateway.handleMarkAsRead('id', createClient())
          : await gateway[method](createClient());

      expect(result).toEqual({ error: 'Not authenticated' });
    });

    it('marks a notification as read', async () => {
      notificationsService.markAsRead.mockResolvedValue({});

      await expect(gateway.handleMarkAsRead('n1', authed())).resolves.toEqual({
        success: true,
      });
      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        'n1',
        mongoId,
      );
    });

    it('returns the error when marking as read fails', async () => {
      notificationsService.markAsRead.mockRejectedValue(new Error('not found'));

      await expect(gateway.handleMarkAsRead('n1', authed())).resolves.toEqual({
        error: 'not found',
      });
    });

    it('marks all notifications as read', async () => {
      notificationsService.markAllAsRead.mockResolvedValue({
        modifiedCount: 3,
      });

      await expect(gateway.handleMarkAllAsRead(authed())).resolves.toEqual({
        success: true,
        modifiedCount: 3,
      });
    });

    it('returns the error when marking all as read fails', async () => {
      notificationsService.markAllAsRead.mockRejectedValue(new Error('db'));

      await expect(gateway.handleMarkAllAsRead(authed())).resolves.toEqual({
        error: 'db',
      });
    });

    it('returns the unread count', async () => {
      await expect(gateway.handleGetUnreadCount(authed())).resolves.toEqual({
        unreadCount: 1,
      });
    });

    it('returns the error when counting fails', async () => {
      notificationsService.findByUser.mockRejectedValue(new Error('db'));

      await expect(gateway.handleGetUnreadCount(authed())).resolves.toEqual({
        error: 'db',
      });
    });
  });
});
