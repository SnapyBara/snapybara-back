import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('NotificationsGateway (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let clientSocket: Socket;
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));

    jwtService = app.get(JwtService);

    await app.init();
    await app.listen(0); // Random port
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    await app.close();
  });

  describe('WebSocket Connection', () => {
    it('should connect with valid JWT token', (done) => {
      const port = app.getHttpServer().address().port;
      const token = jwtService.sign({ sub: testUserId });

      clientSocket = io(`http://localhost:${port}/notifications`, {
        query: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should reject connection without token', (done) => {
      const port = app.getHttpServer().address().port;

      const unauthorizedSocket = io(`http://localhost:${port}/notifications`, {
        transports: ['websocket'],
      });

      unauthorizedSocket.on('connect_error', () => {
        expect(unauthorizedSocket.connected).toBe(false);
        unauthorizedSocket.disconnect();
        done();
      });

      unauthorizedSocket.on('connect', () => {
        unauthorizedSocket.disconnect();
        done(new Error('Should not connect without token'));
      });
    });
  });

  describe('Notifications', () => {
    beforeEach((done) => {
      const port = app.getHttpServer().address().port;
      const token = jwtService.sign({ sub: testUserId });

      clientSocket = io(`http://localhost:${port}/notifications`, {
        query: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done();
      });
    });

    afterEach(() => {
      if (clientSocket) {
        clientSocket.disconnect();
      }
    });

    it('should receive initial notifications on connect', (done) => {
      clientSocket.on('initial_notifications', (data) => {
        expect(data).toHaveProperty('notifications');
        expect(data).toHaveProperty('unreadCount');
        expect(Array.isArray(data.notifications)).toBe(true);
        done();
      });
    });

    it('should receive new notification when points are earned', (done) => {
      clientSocket.on('new_notification', (notification) => {
        expect(notification).toHaveProperty('type', 'points_earned');
        expect(notification).toHaveProperty('title');
        expect(notification).toHaveProperty('message');
        expect(notification.data).toHaveProperty('points');
        done();
      });

      // Simulate points earning (this would normally be triggered by the gamification service)
      setTimeout(() => {
        clientSocket.emit('test_earn_points', { points: 10, reason: 'test' });
      }, 100);
    });

    it('should mark notification as read', (done) => {
      const notificationId = 'test-notification-123';

      clientSocket.emit('mark_read', notificationId, (response) => {
        expect(response).toHaveProperty('success', true);
        done();
      });
    });

    it('should mark all notifications as read', (done) => {
      clientSocket.emit('mark_all_read', (response) => {
        expect(response).toHaveProperty('success', true);
        expect(response).toHaveProperty('modifiedCount');
        done();
      });
    });

    it('should get unread count', (done) => {
      clientSocket.emit('get_unread_count', (response) => {
        expect(response).toHaveProperty('unreadCount');
        expect(typeof response.unreadCount).toBe('number');
        done();
      });
    });
  });

  describe('Achievement Notifications', () => {
    beforeEach((done) => {
      const port = app.getHttpServer().address().port;
      const token = jwtService.sign({ sub: testUserId });

      clientSocket = io(`http://localhost:${port}/notifications`, {
        query: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done();
      });
    });

    it('should receive achievement unlocked notification', (done) => {
      clientSocket.on('new_notification', (notification) => {
        if (notification.type === 'achievement_unlocked') {
          expect(notification).toHaveProperty('title', 'Succès débloqué !');
          expect(notification.data).toHaveProperty('id');
          expect(notification.data).toHaveProperty('name');
          expect(notification.data).toHaveProperty('points');
          done();
        }
      });

      // Simulate achievement unlock
      setTimeout(() => {
        clientSocket.emit('test_unlock_achievement', {
          achievementId: 'first_photo',
        });
      }, 100);
    });

    it('should receive level up notification', (done) => {
      clientSocket.on('new_notification', (notification) => {
        if (notification.type === 'level_up') {
          expect(notification).toHaveProperty('title');
          expect(notification.title).toContain('Niveau');
          expect(notification.data).toHaveProperty('level');
          done();
        }
      });

      // Simulate level up
      setTimeout(() => {
        clientSocket.emit('test_level_up', { newLevel: 2 });
      }, 100);
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      const port = app.getHttpServer().address().port;
      const token = jwtService.sign({ sub: testUserId });

      clientSocket = io(`http://localhost:${port}/notifications`, {
        query: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done();
      });
    });

    it('should handle invalid notification ID gracefully', (done) => {
      clientSocket.emit('mark_read', 'invalid-id', (response) => {
        expect(response).toHaveProperty('error');
        done();
      });
    });

    it('should handle disconnection and reconnection', (done) => {
      let reconnected = false;

      clientSocket.on('disconnect', () => {
        if (!reconnected) {
          reconnected = true;
          clientSocket.connect();
        }
      });

      clientSocket.on('connect', () => {
        if (reconnected) {
          expect(clientSocket.connected).toBe(true);
          done();
        }
      });

      // Force disconnect
      clientSocket.disconnect();
    });
  });
});
