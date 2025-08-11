import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SupabaseAuthGuard } from '../src/auth/guards/supabase-auth.guard';
import { TestAuthGuard } from '../src/auth/guards/test-auth.guard';
import { SupabaseService } from '../src/supabase/supabase.service';
import { UsersService } from '../src/users/users.service';
import { mockSupabaseService, mockCacheManager, mockUsersService } from './test-config';

describe('Points API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdPointId: string;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('CACHE_MANAGER')
      .useValue(mockCacheManager)
      .overrideGuard(SupabaseAuthGuard)
      .useClass(TestAuthGuard)
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }));
    
    await app.init();

    // Create a test JWT service and token
    const jwtService = new JwtService({
      secret: 'test-jwt-secret',
      signOptions: { expiresIn: '1h' },
    });
    
    // Create a test token
    authToken = jwtService.sign({
      sub: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
    });
  }, 30000); // 30 seconds timeout

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('GET /points', () => {
    it('should return paginated points list', async () => {
      const response = await request(app.getHttpServer())
        .get('/points')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/points')
        .query({ category: 'architecture' }) // Utiliser une catégorie valide
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should search by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/points')
        .query({ search: 'Test' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /points', () => {
    it('should create a new point', async () => {
      const createPointDto = {
        name: 'E2E Test Historic Building',
        description: 'A historic building created during E2E testing',
        category: 'architecture', // Utiliser une catégorie valide
        latitude: 48.8566,
        longitude: 2.3522,
        address: {
          formattedAddress: '123 Test Street, Paris, France',
          street: '123 Test Street',
          city: 'Paris',
          country: 'France',
        },
        tags: ['test', 'e2e', 'historic'],
      };

      try {
        const response = await request(app.getHttpServer())
          .post('/points')
          .set('Authorization', `Bearer ${authToken}`)
          .send(createPointDto);

        if (response.status !== 201) {
          console.error('Point creation failed with status:', response.status);
          console.error('Response body:', response.body);
          console.error('Response text:', response.text);
        }

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('_id');
        expect(response.body.name).toBe(createPointDto.name);
        expect(response.body.category).toBe(createPointDto.category);
        expect(response.body.status).toBe('pending');
        createdPointId = response.body._id;
        console.log('Created point with ID:', createdPointId);
      } catch (err) {
        console.error('Test error:', err);
        throw err;
      }
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        name: 'Invalid Point',
        // missing required fields: latitude, longitude, category
      };

      const response = await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should validate coordinate format', async () => {
      const invalidLocationDto = {
        name: 'Invalid Location Point',
        description: 'Test',
        category: 'architecture', // Utiliser une catégorie valide
        latitude: 'not-a-number', // Invalid latitude
        longitude: 'not-a-number', // Invalid longitude
        address: {
          formattedAddress: 'Test address',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidLocationDto)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /points/nearby', () => {
    beforeAll(async () => {
      // Create a point to ensure we have data
      const createPointDto = {
        name: 'Nearby Test Point',
        description: 'A point for nearby testing',
        category: 'urban', // Utiliser une catégorie valide
        latitude: 48.8566,
        longitude: 2.3522,
        address: {
          formattedAddress: '789 Nearby Street, Paris, France',
        },
      };

      await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPointDto);
    });

    it('should return points within specified area', async () => {
      const response = await request(app.getHttpServer())
        .get('/points/nearby')
        .query({
          latitude: 48.8566,
          longitude: 2.3522,
          radius: 5000, // 5km
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        response.body.forEach((point: any) => {
          expect(point).toHaveProperty('distance');
        });
      }
    });
  });

  describe('GET /points/:id', () => {
    it('should return a specific point', async () => {
      // Skip this test if createdPointId is not defined
      if (!createdPointId) {
        console.warn('Skipping test: createdPointId is undefined');
        return;
      }
      
      const response = await request(app.getHttpServer())
        .get(`/points/${createdPointId}`)
        .expect(200);

      expect(response.body._id).toBe(createdPointId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('location');
      expect(response.body).toHaveProperty('category');
      expect(response.body).toHaveProperty('latitude');
      expect(response.body).toHaveProperty('longitude');
      
      // Les photos et reviews sont récupérées via des endpoints séparés
      // GET /points/:id/photos et GET /points/:id/reviews
    });

    it('should return 404 for non-existent point', async () => {
      await request(app.getHttpServer())
        .get('/points/507f1f77bcf86cd799439011') // Valid ObjectId format
        .expect(404);
    });

    it('should get photos for a point via dedicated endpoint', async () => {
      // Skip this test if createdPointId is not defined
      if (!createdPointId) {
        console.warn('Skipping test: createdPointId is undefined');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/points/${createdPointId}/photos`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('PATCH /points/:id', () => {
    it('should update a point', async () => {
      // Skip this test if createdPointId is not defined
      if (!createdPointId) {
        console.warn('Skipping test: createdPointId is undefined');
        return;
      }

      const updateDto = {
        name: 'Updated E2E Test Building',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/points/${createdPointId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe(updateDto.name);
      expect(response.body.description).toBe(updateDto.description);
    });
  });

  describe('POST /points/:id/photos', () => {
    it.skip('should upload a photo for a point', async () => {
      // File upload tests require special handling
      // Skip for now as it requires multipart/form-data
    });
  });

  describe('DELETE /points/:id', () => {
    let pointToDelete: string;

    beforeAll(async () => {
      // Create a specific point to delete
      const createPointDto = {
        name: 'Point to Delete',
        description: 'This point will be deleted',
        category: 'historical', // Utiliser une catégorie valide
        latitude: 48.8566,
        longitude: 2.3522,
        address: {
          formattedAddress: '789 Delete Street, Paris, France',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/points')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPointDto)
        .expect(201);
      
      pointToDelete = response.body._id;
    });

    it('should soft delete a point', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/points/${pointToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should not return deleted points in list', async () => {
      const response = await request(app.getHttpServer())
        .get('/points')
        .expect(200);

      const deletedPoint = response.body.data.find(
        (point: any) => point._id === pointToDelete,
      );
      expect(deletedPoint).toBeUndefined();
    });
  });

  describe('GET /points/:id/reviews', () => {
    it('should get reviews for a point', async () => {
      // Skip this test if createdPointId is not defined
      if (!createdPointId) {
        console.warn('Skipping test: createdPointId is undefined');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/points/${createdPointId}/reviews`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('POST /points/:id/reviews', () => {
    it('should add a review to a point', async () => {
      // Skip this test if createdPointId is not defined
      if (!createdPointId) {
        console.warn('Skipping test: createdPointId is undefined');
        return;
      }

      const reviewDto = {
        rating: 4,
        comment: 'Great place for testing!',
      };

      const response = await request(app.getHttpServer())
        .post(`/points/${createdPointId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewDto)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.rating).toBe(reviewDto.rating);
      expect(response.body.comment).toBe(reviewDto.comment);
      expect(response.body.pointId).toBe(createdPointId);
    });
  });

  describe('Rate Limiting', () => {
    it.skip('should enforce rate limits', async () => {
      // Skip rate limiting tests as they can be flaky in CI
    });
  });
});
