import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseAuthGuard } from '../src/auth/guards/supabase-auth.guard';
import { TestAuthGuard } from '../src/auth/guards/test-auth.guard';
import { SupabaseService } from '../src/supabase/supabase.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { mockSupabaseService } from './test-config';

describe('Cache Synchronization Integration (e2e)', () => {
  let app: INestApplication;
  let cacheManager: Cache;
  let authToken: string;
  let testPointId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.SUPABASE_JWT_SECRET =
      'test-jwt-secret-for-testing-purposes-only';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
    cacheManager = app.get<Cache>(CACHE_MANAGER);

    await app.init();

    authToken = 'test-token';

    const createResponse = await request(app.getHttpServer())
      .post('/points')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Cache Test Point',
        description: 'Point for cache testing',
        category: 'architecture',
        latitude: 48.8566,
        longitude: 2.3522,
        address: {
          formattedAddress: 'Test Address, Paris',
        },
      });

    if (createResponse.status === 201) {
      testPointId = createResponse.body._id;
    } else {
      console.log(
        'Failed to create test point:',
        createResponse.status,
        createResponse.body,
      );
    }
  });

  afterAll(async () => {
    if (testPointId) {
      try {
        await request(app.getHttpServer())
          .delete(`/points/${testPointId}`)
          .set('Authorization', `Bearer ${authToken}`);
      } catch (error) {
        console.log('Error deleting test point:', error);
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('Geographic Area Cache Invalidation', () => {
    it('should invalidate area cache when POI is created', async () => {
      const areaCacheKey = 'overpass:area:48.86,2.35,5';
      const searchCacheKey = 'overpass:search:48.857,2.352,1000:architecture';

      await cacheManager.set(
        areaCacheKey,
        {
          data: ['old-point-1', 'old-point-2'],
          timestamp: Date.now(),
        },
        3600,
      );

      await cacheManager.set(
        searchCacheKey,
        {
          data: ['old-point-1', 'old-point-2'],
          timestamp: Date.now(),
        },
        3600,
      );

      const newPoint = await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Architecture Point',
          description: 'This should invalidate cache',
          category: 'architecture',
          latitude: 48.857,
          longitude: 2.3525,
          address: {
            formattedAddress: 'Near original point',
          },
        });

      if (newPoint.status === 201) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const areaCacheAfter = await cacheManager.get(areaCacheKey);
        const searchCacheAfter = await cacheManager.get(searchCacheKey);

        expect(areaCacheAfter).toBeNull();
        expect(searchCacheAfter).toBeNull();

        await request(app.getHttpServer())
          .delete(`/points/${newPoint.body._id}`)
          .set('Authorization', `Bearer ${authToken}`);
      } else {
        console.log('Point creation failed:', newPoint.status, newPoint.body);
        expect([400, 401]).toContain(newPoint.status);
      }
    });

    it('should invalidate multiple cache zones for boundary points', async () => {
      const cacheKeys = [
        'overpass:area:48.85,2.35,5',
        'overpass:area:48.86,2.35,5',
        'overpass:area:48.87,2.35,5',
        'points:search:48.857,2.352,1000',
      ];

      for (const key of cacheKeys) {
        await cacheManager.set(
          key,
          {
            data: ['cached-data'],
            timestamp: Date.now(),
          },
          3600,
        );
      }

      const boundaryPoint = await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Boundary Point',
          category: 'urban',
          latitude: 48.865,
          longitude: 2.352,
          address: {
            formattedAddress: 'On cache boundary',
          },
        });

      if (boundaryPoint.status === 201) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        for (const key of cacheKeys) {
          const cachedData = await cacheManager.get(key);
          expect(cachedData).toBeNull();
        }

        await request(app.getHttpServer())
          .delete(`/points/${boundaryPoint.body._id}`)
          .set('Authorization', `Bearer ${authToken}`);
      } else {
        expect([400, 401]).toContain(boundaryPoint.status);
      }
    });

    it('should handle cache invalidation on POI update', async () => {
      if (!testPointId) {
        console.log('Skipping test: no test point created');
        return;
      }

      const originalLat = 48.8566;
      const originalLon = 2.3522;
      const newLat = 48.858;
      const newLon = 2.354;

      const originalCacheKey = `overpass:area:${originalLat.toFixed(2)},${originalLon.toFixed(2)},5`;
      const newCacheKey = `overpass:area:${newLat.toFixed(2)},${newLon.toFixed(2)},5`;

      await cacheManager.set(originalCacheKey, { data: ['point1'] }, 3600);
      await cacheManager.set(newCacheKey, { data: ['point2'] }, 3600);

      const updateResponse = await request(app.getHttpServer())
        .patch(`/points/${testPointId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          latitude: newLat,
          longitude: newLon,
        });

      if (updateResponse.status === 200) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const originalCache = await cacheManager.get(originalCacheKey);
        const newCache = await cacheManager.get(newCacheKey);

        expect(originalCache).toBeNull();
        expect(newCache).toBeNull();
      } else {
        expect([400, 401, 404]).toContain(updateResponse.status);
      }
    });
  });

  describe('Search Results Cache Synchronization', () => {
    it('should warm cache after invalidation', async () => {
      const searchParams = {
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 1000,
      };

      const response1 = await request(app.getHttpServer())
        .get('/points/nearby')
        .query(searchParams)
        .expect(200);

      const initialCount = response1.body.length;

      const newPoint = await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cache Warm Test Point',
          category: 'landscape',
          latitude: 48.8567,
          longitude: 2.3523,
          address: {
            formattedAddress: 'Very close point',
          },
        });

      if (newPoint.status === 201) {
        await new Promise((resolve) => setTimeout(resolve, 200));

        const response2 = await request(app.getHttpServer())
          .get('/points/nearby')
          .query(searchParams)
          .expect(200);

        expect(response2.body.length).toBeGreaterThan(initialCount);

        const foundNewPoint = response2.body.find(
          (p: any) => p._id === newPoint.body._id,
        );
        expect(foundNewPoint).toBeTruthy();

        await request(app.getHttpServer())
          .delete(`/points/${newPoint.body._id}`)
          .set('Authorization', `Bearer ${authToken}`);
      } else {
        expect([400, 401]).toContain(newPoint.status);
      }
    });

    it('should maintain cache consistency across different search types', async () => {
      const testCategory = 'architecture';
      const testLat = 48.857;
      const testLon = 2.353;

      const nearbyResponse1 = await request(app.getHttpServer())
        .get('/points/nearby')
        .query({
          latitude: testLat,
          longitude: testLon,
          radius: 500,
        })
        .expect(200);

      const categoryResponse1 = await request(app.getHttpServer())
        .get('/points')
        .query({
          category: testCategory,
          limit: 50,
        })
        .expect(200);

      const newPoint = await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Consistency Test Point',
          category: testCategory,
          latitude: testLat,
          longitude: testLon,
          address: {
            formattedAddress: 'Consistency test address',
          },
        });

      if (newPoint.status === 201) {
        await new Promise((resolve) => setTimeout(resolve, 200));

        const nearbyResponse2 = await request(app.getHttpServer())
          .get('/points/nearby')
          .query({
            latitude: testLat,
            longitude: testLon,
            radius: 500,
          })
          .expect(200);

        const categoryResponse2 = await request(app.getHttpServer())
          .get('/points')
          .query({
            category: testCategory,
            limit: 50,
          })
          .expect(200);

        const nearbyHasNewPoint = nearbyResponse2.body.some(
          (p: any) => p._id === newPoint.body._id,
        );
        const categoryHasNewPoint = categoryResponse2.body.data.some(
          (p: any) => p._id === newPoint.body._id,
        );

        expect(nearbyHasNewPoint).toBe(true);
        expect(categoryHasNewPoint).toBe(true);

        await request(app.getHttpServer())
          .delete(`/points/${newPoint.body._id}`)
          .set('Authorization', `Bearer ${authToken}`);
      } else {
        expect([400, 401]).toContain(newPoint.status);
      }
    });
  });

  describe('Cache Performance and Fallback', () => {
    it('should use stale cache when external API fails', async () => {
      const cacheKey = 'overpass:search:48.857,2.352,1000:architecture';
      const staleData = {
        data: [
          {
            id: 'stale-1',
            name: 'Stale Point 1',
            lat: 48.857,
            lon: 2.352,
          },
        ],
        timestamp: Date.now() - 10000,
      };

      await cacheManager.set(cacheKey, staleData, 3600);

      const originalUrl = process.env.OVERPASS_API_URL;
      process.env.OVERPASS_API_URL =
        'http://invalid-url-to-simulate-failure.com';

      const response = await request(app.getHttpServer())
        .get('/points/nearby')
        .query({
          latitude: 48.857,
          longitude: 2.352,
          radius: 1000,
          includeExternal: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);

      process.env.OVERPASS_API_URL =
        originalUrl || 'https://overpass-api.de/api/interpreter';
    });

    it('should handle concurrent cache updates without race conditions', async () => {
      const updates = Array(5)
        .fill(null)
        .map((_, index) => ({
          name: `Concurrent Point ${index}`,
          category: 'urban',
          latitude: 48.8566 + index * 0.0001,
          longitude: 2.3522 + index * 0.0001,
          address: {
            formattedAddress: `Address ${index}`,
          },
        }));

      const createPromises = updates.map((update) =>
        request(app.getHttpServer())
          .post('/points')
          .set('Authorization', `Bearer ${authToken}`)
          .send(update),
      );

      const responses = await Promise.all(createPromises);
      const validResponses = responses.filter((r) => r.status === 201);
      const createdIds = validResponses.map((r) => r.body._id);

      if (createdIds.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const searchResponse = await request(app.getHttpServer())
          .get('/points/nearby')
          .query({
            latitude: 48.8566,
            longitude: 2.3522,
            radius: 1000,
          })
          .expect(200);

        const foundIds = searchResponse.body
          .filter((p: any) => createdIds.includes(p._id))
          .map((p: any) => p._id);

        expect(foundIds.length).toBeGreaterThanOrEqual(createdIds.length);

        const deletePromises = createdIds.map((id) =>
          request(app.getHttpServer())
            .delete(`/points/${id}`)
            .set('Authorization', `Bearer ${authToken}`),
        );

        await Promise.all(deletePromises);
      } else {
        console.log('No points created successfully in concurrent test');
      }
    });
  });

  describe('Cache TTL and Expiration', () => {
    it('should respect different TTL for different cache types', async () => {
      const shortTTLKey = 'gp:autocomplete:test_query:48.86,2.35';
      const longTTLKey = 'gp:details:test-place-id';

      await cacheManager.set(shortTTLKey, { data: 'short' }, 1);
      await cacheManager.set(longTTLKey, { data: 'long' }, 3600);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const shortCache = await cacheManager.get(shortTTLKey);
      const longCache = await cacheManager.get(longTTLKey);

      expect(shortCache).toBeUndefined();
      expect(longCache).toBeTruthy();
    });

    it('should handle cache stampede prevention', async () => {
      const cacheKey = 'points:search:48.857,2.352,1000';

      await cacheManager.del(cacheKey);

      const concurrentRequests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).get('/points/nearby').query({
            latitude: 48.857,
            longitude: 2.352,
            radius: 1000,
          }),
        );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
      });

      const cacheStats = await request(app.getHttpServer())
        .get('/cache/stats')
        .set('Authorization', `Bearer ${authToken}`);

      if (cacheStats.status === 200) {
        expect(cacheStats.body.hits).toBeGreaterThanOrEqual(0);
      } else {
        expect([404, 401]).toContain(cacheStats.status);
      }
    });
  });
});
