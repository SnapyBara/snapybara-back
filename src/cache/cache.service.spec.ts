import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import { Cache } from 'cache-manager';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: Cache;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should get value from cache', async () => {
      const key = 'test-key';
      const value = { data: 'test' };

      mockCacheManager.get.mockResolvedValue(value);

      const result = await service.get(key);

      expect(cacheManager.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it('should return undefined on error', async () => {
      const key = 'test-key';

      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      const result = await service.get(key);

      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set value in cache with default TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test' };

      await service.set(key, value);

      expect(cacheManager.set).toHaveBeenCalledWith(key, value, 3600);
    });

    it('should set value with custom TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      const ttl = 7200;

      await service.set(key, value, { ttl });

      expect(cacheManager.set).toHaveBeenCalledWith(key, value, ttl);
    });
  });

  describe('del', () => {
    it('should delete key from cache', async () => {
      const key = 'test-key';

      await service.del(key);

      expect(cacheManager.del).toHaveBeenCalledWith(key);
    });
  });

  describe('reset', () => {
    it('should log warning that reset is not available', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await service.reset();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Cache RESET - Method not available in this version',
      );
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const key = 'test-key';
      const cachedValue = { data: 'cached' };
      const factory = jest.fn();

      mockCacheManager.get.mockResolvedValue(cachedValue);

      const result = await service.getOrSet(key, factory);

      expect(result).toEqual(cachedValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not cached', async () => {
      const key = 'test-key';
      const newValue = { data: 'new' };
      const factory = jest.fn().mockResolvedValue(newValue);
      const ttl = 1800;

      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.getOrSet(key, factory, { ttl });

      expect(factory).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalledWith(key, newValue, ttl);
      expect(result).toEqual(newValue);
    });
  });

  describe('key generation methods', () => {
    it('should generate Google Places search key', () => {
      const params = {
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 1000,
        type: 'restaurant',
        keyword: 'french food',
      };

      const result = service.generateGooglePlacesSearchKey(params);

      expect(result).toBe('gp:search:48.857,2.352,1000:restaurant:french_food');
    });

    it('should generate Google Places text search key', () => {
      const params = {
        query: 'pizza paris',
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 5000,
      };

      const result = service.generateGooglePlacesTextSearchKey(params);

      expect(result).toBe('gp:search:text:pizza_paris:48.857,2.352:5000');
    });

    it('should generate autocomplete key', () => {
      const params = {
        input: 'eiffel',
        latitude: 48.8566,
        longitude: 2.3522,
      };

      const result = service.generateAutocompleteKey(params);

      expect(result).toBe('gp:autocomplete:eiffel:48.86,2.35');
    });

    it('should generate place details key', () => {
      const placeId = 'ChIJLU7jZClu5kcR4PcOOO6p3I0';

      const result = service.generatePlaceDetailsKey(placeId);

      expect(result).toBe('gp:details:ChIJLU7jZClu5kcR4PcOOO6p3I0');
    });

    it('should generate photo key', () => {
      const photoReference = 'photo-ref-123';
      const maxWidth = 400;

      const result = service.generatePhotoKey(photoReference, maxWidth);

      expect(result).toBe('gp:photos:photo-ref-123:400');
    });

    it('should generate Overpass search key', () => {
      const params = {
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 1000,
        categories: ['tourism', 'amenity'],
      };

      const result = service.generateOverpassSearchKey(params);

      expect(result).toBe('overpass:search:48.857,2.352,1000:amenity,tourism');
    });

    it('should generate Overpass area key', () => {
      const result = service.generateOverpassAreaKey(48.8566, 2.3522, 5);

      expect(result).toBe('overpass:area:48.86,2.35,5');
    });

    it('should generate Nominatim key', () => {
      const category = 'restaurant';
      const bounds = {
        minLat: 48.8,
        minLon: 2.3,
        maxLat: 48.9,
        maxLon: 2.4,
      };

      const result = service.generateNominatimKey(category, bounds);

      expect(result).toBe(
        'overpass:nominatim:restaurant:48.80,2.30,48.90,2.40',
      );
    });
  });

  describe('hasNearbyCache', () => {
    it('should find nearby cached data', async () => {
      const nearbyKey = 'overpass:area:48.86,2.35,5';
      mockCacheManager.get.mockResolvedValueOnce(undefined);
      mockCacheManager.get.mockResolvedValueOnce({ data: 'nearby' });

      const result = await service.hasNearbyCache(48.8566, 2.3522, 5);

      expect(cacheManager.get).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('should return null if no nearby cache found', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.hasNearbyCache(48.8566, 2.3522, 5);

      expect(result).toBeNull();
    });
  });

  describe('getOrSetWithFreshness', () => {
    it('should use stale cache on error with fallback option', async () => {
      const key = 'test-key';
      const staleValue = { data: 'stale' };
      const factory = jest.fn().mockRejectedValue(new Error('API error'));

      mockCacheManager.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(staleValue);

      const result = await service.getOrSetWithFreshness(key, factory, {
        fallbackOnError: true,
      });

      expect(result).toEqual(staleValue);
    });

    it('should throw error without fallback option', async () => {
      const key = 'test-key';
      const factory = jest.fn().mockRejectedValue(new Error('API error'));

      mockCacheManager.get.mockResolvedValue(undefined);

      await expect(service.getOrSetWithFreshness(key, factory)).rejects.toThrow(
        'API error',
      );
    });
  });

  describe('invalidateAreaCache', () => {
    it('should log area cache invalidation request', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'debug');

      await service.invalidateAreaCache(48.8566, 2.3522, 1000);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Area cache invalidation requested for 48.8566,2.3522 radius 1000',
      );
    });
  });

  describe('getStats', () => {
    it('should return default stats', async () => {
      const stats = await service.getStats();

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        hitRate: 0,
      });
    });
  });

  describe('getMetrics', () => {
    it('should return cache metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toEqual({
        type: 'memory',
        status: 'active',
      });
    });
  });
});
