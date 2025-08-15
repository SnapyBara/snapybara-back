import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseAuthGuard } from '../src/auth/guards/supabase-auth.guard';
import { TestAuthGuard } from '../src/auth/guards/test-auth.guard';
import { SupabaseService } from '../src/supabase/supabase.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { mockSupabaseService, mockCacheManager } from './test-config';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.SUPABASE_JWT_SECRET =
      'test-jwt-secret-for-testing-purposes-only';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('CACHE_MANAGER')
      .useValue(mockCacheManager)
      .overrideGuard(SupabaseAuthGuard)
      .useClass(TestAuthGuard)
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
    await app.init();
  }, 30000);

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.text).toContain('Hello');
      });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'OK');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('environment', 'test');
      });
  });

  it('/info (GET)', () => {
    return request(app.getHttpServer())
      .get('/info')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('name', 'SnapyBara API');
        expect(res.body).toHaveProperty('version', '1.0.0');
        expect(res.body).toHaveProperty('endpoints');
      });
  });

  it('/docs (GET)', () => {
    return request(app.getHttpServer())
      .get('/docs')
      .expect(200)
      .expect('Content-Type', /html/);
  });
});
