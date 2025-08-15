import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../src/users/schemas/user.schema';
import * as crypto from 'crypto';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseService } from '../src/supabase/supabase.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { mockSupabaseService } from './test-config';

describe('Supabase Webhook Integration (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<User>;
  const webhookSecret = 'test-webhook-secret';
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const generateWebhookSignature = (payload: any): string => {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'disabled-for-tests';
    process.env.SUPABASE_WEBHOOK_SECRET = webhookSecret;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.SUPABASE_JWT_SECRET =
      'test-jwt-secret-for-testing-purposes-only';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_GUARD)
      .useValue({ canActivate: () => true })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .overrideProvider(JwtStrategy)
      .useValue({
        validate: jest.fn().mockResolvedValue({
          sub: 'test-user-id',
          email: 'test@example.com',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    userModel = app.get<Model<User>>(getModelToken(User.name));
    await app.init();
  });

  afterAll(async () => {
    if (userModel) {
      try {
        await userModel.deleteMany({});
      } catch (error) {
        console.log('Error cleaning up users:', error);
      }
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    if (userModel) {
      await userModel.deleteMany({});
    }
  });

  describe('User Registration Webhook', () => {
    it('should create user in MongoDB when Supabase user registers', async () => {
      const supabaseUserId = 'auth-' + Date.now();
      const webhookPayload = {
        type: 'INSERT',
        table: 'auth.users',
        record: {
          id: supabaseUserId,
          email: 'test-webhook@example.com',
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw_user_meta_data: {
            username: 'testwebhookuser',
            full_name: 'Test Webhook User',
          },
        },
        schema: 'auth',
        old_record: null,
      };
      const signature = generateWebhookSignature(webhookPayload);
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .set('X-Supabase-Signature', signature)
        .send(webhookPayload)
        .expect(HttpStatus.OK);
      await wait(120);
      const createdUser = await userModel.findOne({
        supabaseId: supabaseUserId,
      });
      expect(createdUser).toBeTruthy();
      if (createdUser) {
        expect(createdUser.email).toBe('test-webhook@example.com');
        expect(createdUser.username).toBe('testwebhookuser');
        expect(createdUser.role).toBe('user');
        expect(createdUser.isEmailVerified).toBe(true);
      }
    });

    it('should handle OAuth registration with provider data', async () => {
      const supabaseUserId = 'oauth-' + Date.now();
      const webhookPayload = {
        type: 'INSERT',
        table: 'auth.users',
        record: {
          id: supabaseUserId,
          email: 'oauth-webhook@gmail.com',
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          raw_app_meta_data: {
            provider: 'google',
            providers: ['google'],
          },
          raw_user_meta_data: {
            email: 'oauth-webhook@gmail.com',
            email_verified: true,
            full_name: 'OAuth Test User',
            iss: 'https://accounts.google.com',
            name: 'OAuth Test User',
            picture: 'https://lh3.googleusercontent.com/test-avatar',
            provider_id: '1234567890',
            sub: '1234567890',
          },
        },
        schema: 'auth',
      };
      const signature = generateWebhookSignature(webhookPayload);
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .set('X-Supabase-Signature', signature)
        .send(webhookPayload)
        .expect(HttpStatus.OK);
      await wait(120);
      const createdUser = await userModel.findOne({
        supabaseId: supabaseUserId,
      });
      expect(createdUser).toBeTruthy();
      if (createdUser) {
        expect(createdUser.email).toBe('oauth-webhook@gmail.com');
        expect(createdUser.username).toBeTruthy();
        expect(createdUser.metadata).toBeDefined();
      }
    });

    it('should handle duplicate user registration gracefully', async () => {
      const supabaseUserId = 'duplicate-' + Date.now();
      const webhookPayload = {
        type: 'INSERT',
        table: 'auth.users',
        record: {
          id: supabaseUserId,
          email: 'duplicate-webhook@example.com',
          created_at: new Date().toISOString(),
          raw_user_meta_data: {
            username: 'duplicateuser',
          },
        },
        schema: 'auth',
      };
      const signature = generateWebhookSignature(webhookPayload);
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .set('X-Supabase-Signature', signature)
        .send(webhookPayload)
        .expect(HttpStatus.OK);
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .set('X-Supabase-Signature', signature)
        .send(webhookPayload)
        .expect(HttpStatus.OK);
      const users = await userModel.find({ supabaseId: supabaseUserId });
      expect(users.length).toBe(1);
    });
  });

  describe('User Update Webhook', () => {
    it('should update user profile when Supabase user is updated', async () => {
      const supabaseUserId = 'update-' + Date.now();
      await userModel.create({
        supabaseId: supabaseUserId,
        email: 'update-webhook@example.com',
        username: 'oldusername',
        displayName: 'Old Name',
      });
      const webhookPayload = {
        type: 'UPDATE',
        table: 'auth.users',
        record: {
          id: supabaseUserId,
          email: 'update-webhook@example.com',
          updated_at: new Date().toISOString(),
          raw_user_meta_data: {
            username: 'newusername',
            full_name: 'New Name',
            bio: 'Updated bio',
          },
        },
        old_record: {
          id: supabaseUserId,
          email: 'update-webhook@example.com',
          raw_user_meta_data: {
            username: 'oldusername',
            full_name: 'Old Name',
          },
        },
        schema: 'auth',
      };
      const signature = generateWebhookSignature(webhookPayload);
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .set('X-Supabase-Signature', signature)
        .send(webhookPayload)
        .expect(HttpStatus.OK);
      await wait(120);
      const updatedUser = await userModel.findOne({
        supabaseId: supabaseUserId,
      });
      expect(updatedUser).toBeTruthy();
      if (updatedUser) {
        expect(updatedUser.username).toBe('newusername');
        expect(updatedUser.metadata).toBeDefined();
      }
    });

    it('should handle email verification status updates', async () => {
      const supabaseUserId = 'verify-' + Date.now();
      await userModel.create({
        supabaseId: supabaseUserId,
        email: 'verify-webhook@example.com',
        username: 'verifyuser',
        isEmailVerified: false,
      });
      const webhookPayload = {
        type: 'UPDATE',
        table: 'auth.users',
        record: {
          id: supabaseUserId,
          email: 'verify-webhook@example.com',
          email_confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        old_record: {
          id: supabaseUserId,
          email: 'verify-webhook@example.com',
          email_confirmed_at: null,
        },
        schema: 'auth',
      };
      const signature = generateWebhookSignature(webhookPayload);
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .set('X-Supabase-Signature', signature)
        .send(webhookPayload)
        .expect(HttpStatus.OK);
      await wait(120);
      const updatedUser = await userModel.findOne({
        supabaseId: supabaseUserId,
      });
      expect(updatedUser).toBeTruthy();
      if (updatedUser) {
        expect(updatedUser.isEmailVerified).toBe(true);
      }
    });
  });

  describe('User Deletion Webhook', () => {
    it('should soft delete user when Supabase user is deleted', async () => {
      const supabaseUserId = 'delete-' + Date.now();
      await userModel.create({
        supabaseId: supabaseUserId,
        email: 'delete-webhook@example.com',
        username: 'deleteuser',
        isActive: true,
      });
      const webhookPayload = {
        type: 'DELETE',
        table: 'auth.users',
        record: null,
        old_record: {
          id: supabaseUserId,
          email: 'delete-webhook@example.com',
        },
        schema: 'auth',
      };
      const signature = generateWebhookSignature(webhookPayload);
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .set('X-Supabase-Signature', signature)
        .send(webhookPayload)
        .expect(HttpStatus.OK);
      await wait(120);
      const deletedUser = await userModel.findOne({
        supabaseId: supabaseUserId,
      });
      expect(deletedUser).toBeTruthy();
      if (deletedUser) {
        expect(deletedUser.isActive).toBe(false);
      }
    });
  });

  describe('Webhook Security', () => {
    it('should reject webhooks with invalid signature', async () => {
      const webhookPayload = {
        type: 'INSERT',
        table: 'auth.users',
        record: { id: 'security-test', email: 'security@example.com' },
        schema: 'auth',
      };
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .set('X-Supabase-Signature', 'invalid-signature')
        .send(webhookPayload)
        .expect(HttpStatus.UNAUTHORIZED);
      const user = await userModel.findOne({ supabaseId: 'security-test' });
      expect(user).toBeFalsy();
    });

    it('should reject webhooks without signature', async () => {
      const webhookPayload = {
        type: 'INSERT',
        table: 'auth.users',
        record: {
          id: 'no-signature-test',
          email: 'nosig@example.com',
        },
        schema: 'auth',
      };
      await request(app.getHttpServer())
        .post('/webhooks/supabase')
        .send(webhookPayload)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should handle malformed webhook payloads gracefully', async () => {
      const malformedPayloads = [
        null,
        {},
        { type: 'INSERT' },
        { type: 'INSERT', table: 'wrong.table' },
        { type: 'INVALID_TYPE', table: 'auth.users' },
      ];
      for (const payload of malformedPayloads) {
        if (payload === null) {
          await request(app.getHttpServer())
            .post('/webhooks/supabase')
            .send({})
            .expect((res) => {
              expect([
                HttpStatus.OK,
                HttpStatus.BAD_REQUEST,
                HttpStatus.UNAUTHORIZED,
              ]).toContain(res.status);
            });
        } else {
          const signature = generateWebhookSignature(payload);
          await request(app.getHttpServer())
            .post('/webhooks/supabase')
            .set('X-Supabase-Signature', signature)
            .send(payload)
            .expect((res) => {
              expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(
                res.status,
              );
            });
        }
      }
    });
  });

  describe('Webhook Idempotency', () => {
    it('should handle duplicate webhook deliveries idempotently', async () => {
      const supabaseUserId = 'idempotent-' + Date.now();
      const webhookPayload = {
        type: 'INSERT',
        table: 'auth.users',
        record: {
          id: supabaseUserId,
          email: 'idempotent@example.com',
          created_at: new Date().toISOString(),
          raw_user_meta_data: {
            username: 'idempotentuser',
          },
        },
        schema: 'auth',
      };
      const signature = generateWebhookSignature(webhookPayload);
      const responses = await Promise.all([
        request(app.getHttpServer())
          .post('/webhooks/supabase')
          .set('X-Supabase-Signature', signature)
          .send(webhookPayload),
        request(app.getHttpServer())
          .post('/webhooks/supabase')
          .set('X-Supabase-Signature', signature)
          .send(webhookPayload),
        request(app.getHttpServer())
          .post('/webhooks/supabase')
          .set('X-Supabase-Signature', signature)
          .send(webhookPayload),
      ]);
      responses.forEach((res) => expect(res.status).toBe(HttpStatus.OK));
      await wait(220);
      const users = await userModel.find({ supabaseId: supabaseUserId });
      expect(users.length).toBe(1);
    });
  });
});
