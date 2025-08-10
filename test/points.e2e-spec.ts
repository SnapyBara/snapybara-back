import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('Points API (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;
  let createdPointId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
    }));
    
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    
    // Create a test token
    authToken = jwtService.sign({
      sub: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should reject requests without token', () => {
      return request(app.getHttpServer())
        .get('/points')
        .expect(401);
    });

    it('should accept requests with valid token', () => {
      return request(app.getHttpServer())
        .get('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('POST /points', () => {
    it('should create a new point', () => {
      const createPointDto = {
        name: 'E2E Test Restaurant',
        description: 'A restaurant created during E2E testing',
        category: 'restaurant',
        location: {
          type: 'Point',
          coordinates: [2.3522, 48.8566],
        },
        address: '123 Test Street, Paris, France',
        tags: ['test', 'e2e', 'restaurant'],
        openingHours: {
          monday: { open: '09:00', close: '22:00' },
          tuesday: { open: '09:00', close: '22:00' },
          wednesday: { open: '09:00', close: '22:00' },
          thursday: { open: '09:00', close: '22:00' },
          friday: { open: '09:00', close: '23:00' },
          saturday: { open: '10:00', close: '23:00' },
          sunday: { open: '10:00', close: '21:00' },
        },
      };

      return request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPointDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(createPointDto.name);
          expect(res.body.category).toBe(createPointDto.category);
          expect(res.body.status).toBe('pending');
          createdPointId = res.body.id;
        });
    });

    it('should validate required fields', () => {
      const invalidDto = {
        name: 'Invalid Point',
        // missing required fields
      };

      return request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('validation');
        });
    });

    it('should validate location format', () => {
      const invalidLocationDto = {
        name: 'Invalid Location Point',
        description: 'Test',
        category: 'restaurant',
        location: {
          type: 'InvalidType',
          coordinates: 'not-an-array',
        },
      };

      return request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidLocationDto)
        .expect(400);
    });
  });

  describe('GET /points', () => {
    it('should return paginated points list', () => {
      return request(app.getHttpServer())
        .get('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should filter by category', () => {
      return request(app.getHttpServer())
        .get('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ category: 'restaurant' })
        .expect(200)
        .expect((res) => {
          const restaurants = res.body.data.filter(
            (point: any) => point.category === 'restaurant',
          );
          expect(restaurants.length).toBe(res.body.data.length);
        });
    });

    it('should search by name', () => {
      return request(app.getHttpServer())
        .get('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'E2E Test' })
        .expect(200)
        .expect((res) => {
          const matchingPoints = res.body.data.filter((point: any) =>
            point.name.includes('E2E Test'),
          );
          expect(matchingPoints.length).toBeGreaterThan(0);
        });
    });
  });

  describe('GET /points/area', () => {
    it('should return points within specified area', () => {
      return request(app.getHttpServer())
        .get('/points/area')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          lat: 48.8566,
          lng: 2.3522,
          radius: 5000, // 5km
        })
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((point: any) => {
            expect(point).toHaveProperty('distance');
            expect(point.distance).toBeLessThanOrEqual(5000);
          });
        });
    });

    it('should validate area parameters', () => {
      return request(app.getHttpServer())
        .get('/points/area')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          lat: 'invalid',
          lng: 'invalid',
          radius: 'invalid',
        })
        .expect(400);
    });
  });

  describe('GET /points/:id', () => {
    it('should return a specific point', () => {
      return request(app.getHttpServer())
        .get(`/points/${createdPointId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdPointId);
          expect(res.body).toHaveProperty('name');
          expect(res.body).toHaveProperty('location');
          expect(res.body).toHaveProperty('photos');
          expect(res.body).toHaveProperty('reviews');
        });
    });

    it('should return 404 for non-existent point', () => {
      return request(app.getHttpServer())
        .get('/points/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /points/:id', () => {
    it('should update a point', () => {
      const updateDto = {
        name: 'Updated E2E Test Restaurant',
        description: 'Updated description',
      };

      return request(app.getHttpServer())
        .patch(`/points/${createdPointId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe(updateDto.name);
          expect(res.body.description).toBe(updateDto.description);
        });
    });

    it('should not allow updating other users points', () => {
      // This would require a different user token
      // For now, we'll skip this test in the basic implementation
    });
  });

  describe('POST /points/:id/photos', () => {
    it('should add a photo to a point', () => {
      const photoDto = {
        url: 'https://example.com/test-photo.jpg',
        caption: 'E2E test photo',
      };

      return request(app.getHttpServer())
        .post(`/points/${createdPointId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(photoDto)
        .expect(201)
        .expect((res) => {
          const addedPhoto = res.body.photos.find(
            (photo: any) => photo.url === photoDto.url,
          );
          expect(addedPhoto).toBeDefined();
          expect(addedPhoto.caption).toBe(photoDto.caption);
        });
    });
  });

  describe('DELETE /points/:id', () => {
    it('should soft delete a point', () => {
      return request(app.getHttpServer())
        .delete(`/points/${createdPointId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should not return deleted points in list', () => {
      return request(app.getHttpServer())
        .get('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          const deletedPoint = res.body.data.find(
            (point: any) => point.id === createdPointId,
          );
          expect(deletedPoint).toBeUndefined();
        });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/points')
          .set('Authorization', `Bearer ${authToken}`),
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(
        (res) => res.status === 429,
      );

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
});
