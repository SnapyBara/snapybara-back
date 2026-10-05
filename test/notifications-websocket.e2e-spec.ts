import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { NotificationsGateway } from '../src/notifications/notifications.gateway';
import { Notification } from '../src/notifications/schemas/notification.schema';
import { mockSupabaseService } from './test-config';

describe('NotificationsGateway (e2e)', () => {
  let app: INestApplication;
  let gateway: NotificationsGateway;
  let notificationModel: Model<Notification>;
  let url: string;
  const sockets: Socket[] = [];
  const validToken = 'valid-test-token';
  const mongoId = new Types.ObjectId().toString();

  const mockAuthService = {
    validateSupabaseToken: jest.fn(async (token: string) => {
      if (token !== validToken) {
        throw new UnauthorizedException('Invalid authentication token');
      }
      return { id: 'supabase-user', mongoId, email: 'ws@example.com' };
    }),
  };

  const connect = (token?: string): Socket => {
    const socket = io(url, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      ...(token ? { query: { token } } : {}),
    });
    sockets.push(socket);
    return socket;
  };

  const connectAndGetInitial = () =>
    new Promise<{ socket: Socket; initial: any }>((resolve, reject) => {
      const socket = connect(validToken);
      socket.on('initial_notifications', (initial) =>
        resolve({ socket, initial }),
      );
      socket.on('connect_error', reject);
    });

  const emitWithAck = (socket: Socket, event: string, ...args: any[]) =>
    new Promise<any>((resolve) => socket.emit(event, ...args, resolve));

  beforeAll(async () => {
    process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'disabled-for-tests';
    process.env.SUPABASE_URL ??= 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-key';
    process.env.SUPABASE_JWT_SECRET ??=
      'test-jwt-secret-for-testing-purposes-only';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0);

    gateway = app.get(NotificationsGateway);
    notificationModel = app.get<Model<Notification>>(
      getModelToken(Notification.name),
    );
    url = `http://localhost:${app.getHttpServer().address().port}/notifications`;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await notificationModel?.deleteMany({});
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Connection', () => {
    it('sends initial notifications to an authenticated client', async () => {
      await notificationModel.create({
        userId: new Types.ObjectId(mongoId),
        type: 'achievement_earned',
        title: 'Existing',
        message: 'Existing notification',
      });

      const { socket, initial } = await connectAndGetInitial();

      expect(socket.connected).toBe(true);
      expect(initial.unreadCount).toBe(1);
      expect(initial.notifications).toHaveLength(1);
      expect(initial.notifications[0]).toHaveProperty('id');
    });

    it('disconnects a client without token', (done) => {
      const socket = connect();
      socket.on('disconnect', () => done());
    });

    it('disconnects a client with an invalid token', (done) => {
      const socket = connect('invalid-token');
      socket.on('disconnect', () => done());
    });
  });

  describe('Server events', () => {
    it('pushes a notification when points are earned', async () => {
      const { socket } = await connectAndGetInitial();
      const received = new Promise<any>((resolve) =>
        socket.on('new_notification', resolve),
      );

      await gateway.notifyPointsEarned(mongoId, 10, 'test', 110);
      const notification = await received;

      expect(notification.type).toBe('achievement_earned');
      expect(notification.data).toMatchObject({ points: 10, newTotal: 110 });
      expect(notification.id).toBeDefined();
    });

    it('pushes a notification on level up', async () => {
      const { socket } = await connectAndGetInitial();
      const received = new Promise<any>((resolve) =>
        socket.on('new_notification', resolve),
      );

      await gateway.notifyLevelUp(mongoId, 2);
      const notification = await received;

      expect(notification.title).toContain('Niveau 2');
      expect(notification.data).toMatchObject({ level: 2 });
    });
  });

  describe('Client messages', () => {
    it('marks a notification as read', async () => {
      const created = await notificationModel.create({
        userId: new Types.ObjectId(mongoId),
        type: 'achievement_earned',
        title: 'To read',
        message: 'To read',
      });
      const { socket } = await connectAndGetInitial();

      const response = await emitWithAck(
        socket,
        'mark_read',
        created._id.toString(),
      );

      expect(response).toEqual({ success: true });
      const updated = await notificationModel.findById(created._id);
      expect(updated?.isRead).toBe(true);
    });

    it('returns an error for an unknown notification', async () => {
      const { socket } = await connectAndGetInitial();

      const response = await emitWithAck(
        socket,
        'mark_read',
        new Types.ObjectId().toString(),
      );

      expect(response).toHaveProperty('error');
    });

    it('marks all notifications as read and returns the unread count', async () => {
      await notificationModel.create([
        {
          userId: new Types.ObjectId(mongoId),
          type: 'achievement_earned',
          title: 'A',
          message: 'A',
        },
        {
          userId: new Types.ObjectId(mongoId),
          type: 'achievement_earned',
          title: 'B',
          message: 'B',
        },
      ]);
      const { socket } = await connectAndGetInitial();

      expect(await emitWithAck(socket, 'get_unread_count')).toEqual({
        unreadCount: 2,
      });
      expect(await emitWithAck(socket, 'mark_all_read')).toEqual({
        success: true,
        modifiedCount: 2,
      });
      expect(await emitWithAck(socket, 'get_unread_count')).toEqual({
        unreadCount: 0,
      });
    });
  });
});
