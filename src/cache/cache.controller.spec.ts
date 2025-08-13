import { Test, TestingModule } from '@nestjs/testing';
import { CacheController } from './cache.controller';
import { CacheService } from './cache.service';
import { SimpleJwtAuthGuard } from '../auth/guards/simple-jwt-auth.guard';

describe('CacheController', () => {
  let controller: CacheController;
  let service: CacheService;

  const mockCacheService = {
    getStats: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CacheController],
      providers: [
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    })
      .overrideGuard(SimpleJwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<CacheController>(CacheController);
    service = module.get<CacheService>(CacheService);
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const mockStats = {
        hits: 100,
        misses: 20,
        hitRate: 0.83,
      };

      mockCacheService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(service.getStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('resetCache', () => {
    it('should return message that reset is not available', async () => {
      const result = await controller.resetCache();

      expect(result).toEqual({
        message: 'Cache reset not available in this version',
        suggestion: 'Use specific cache key deletion instead',
      });
      expect(service.reset).not.toHaveBeenCalled();
    });
  });
});
