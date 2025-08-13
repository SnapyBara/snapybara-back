import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  private readonly PREFIXES = {
    GOOGLE_PLACES_SEARCH: 'gp:search:',
    GOOGLE_PLACES_DETAILS: 'gp:details:',
    GOOGLE_PLACES_PHOTOS: 'gp:photos:',
    GOOGLE_PLACES_AUTOCOMPLETE: 'gp:autocomplete:',
    POINTS_SEARCH: 'points:search:',
    POINTS_DETAILS: 'points:details:',
    OVERPASS_SEARCH: 'overpass:search:',
    OVERPASS_AREA: 'overpass:area:',
    OVERPASS_NOMINATIM: 'overpass:nominatim:',
  };

  public readonly DEFAULT_TTL = {
    SEARCH: 3600,
    DETAILS: 86400,
    PHOTOS: 604800,
    AUTOCOMPLETE: 1800,
    OVERPASS_SEARCH: 7200,
    OVERPASS_AREA: 10800,
    OVERPASS_NOMINATIM: 3600,
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get cache value
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache HIT for key: ${key}`);
      } else {
        this.logger.debug(`Cache MISS for key: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`Error getting cache for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Define value in cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.DEFAULT_TTL.SEARCH;
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cache SET for key: ${key} with TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Error setting cache for key ${key}:`, error);
    }
  }

  /**
   * Delete other value on cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting cache for key ${key}:`, error);
    }
  }

  /**
   * Vider tout le cache (à utiliser avec précaution)
   */
  async reset(): Promise<void> {
    try {
      this.logger.warn('Cache RESET - Method not available in this version');
    } catch (error) {
      this.logger.error('Error resetting cache:', error);
    }
  }

  /**
   * Generate key for POI google palce in cache
   */
  generateGooglePlacesSearchKey(params: {
    latitude: number;
    longitude: number;
    radius: number;
    type?: string;
    keyword?: string;
  }): string {
    const { latitude, longitude, radius, type, keyword } = params;
    // Arrondir les coordonnées pour grouper les recherches proches
    const lat = Math.round(latitude * 1000) / 1000;
    const lng = Math.round(longitude * 1000) / 1000;

    let key = `${this.PREFIXES.GOOGLE_PLACES_SEARCH}${lat},${lng},${radius}`;
    if (type) key += `:${type}`;
    if (keyword) key += `:${keyword.toLowerCase().replace(/\s+/g, '_')}`;

    return key;
  }

  generateGooglePlacesTextSearchKey(params: {
    query: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }): string {
    const { query, latitude, longitude, radius } = params;
    let key = `${this.PREFIXES.GOOGLE_PLACES_SEARCH}text:${query.toLowerCase().replace(/\s+/g, '_')}`;

    if (latitude && longitude) {
      const lat = Math.round(latitude * 1000) / 1000;
      const lng = Math.round(longitude * 1000) / 1000;
      key += `:${lat},${lng}`;
      if (radius) key += `:${radius}`;
    }

    return key;
  }

  /**
   * autocompletion
   */
  generateAutocompleteKey(params: {
    input: string;
    latitude?: number;
    longitude?: number;
  }): string {
    const { input, latitude, longitude } = params;
    let key = `${this.PREFIXES.GOOGLE_PLACES_AUTOCOMPLETE}${input.toLowerCase().replace(/\s+/g, '_')}`;

    if (latitude && longitude) {
      const lat = Math.round(latitude * 100) / 100; // Moins précis pour l'autocomplétion
      const lng = Math.round(longitude * 100) / 100;
      key += `:${lat},${lng}`;
    }

    return key;
  }

  generatePlaceDetailsKey(placeId: string): string {
    return `${this.PREFIXES.GOOGLE_PLACES_DETAILS}${placeId}`;
  }

  generatePhotoKey(photoReference: string, maxWidth: number): string {
    return `${this.PREFIXES.GOOGLE_PLACES_PHOTOS}${photoReference}:${maxWidth}`;
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();

    await this.set(key, value, options);

    return value;
  }

  /**
   * Stop request for a zone that exist in cache
   */
  async invalidateAreaCache(
    latitude: number,
    longitude: number,
    radius: number,
  ): Promise<void> {
    // TODO: Implémenter l'invalidation par zone si nécessaire
    this.logger.debug(
      `Area cache invalidation requested for ${latitude},${longitude} radius ${radius}`,
    );
  }

  /**
   * Obtain statistique
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
    };
  }

  /**
   * Generate key cache for Overpass api
   */
  generateOverpassSearchKey(params: {
    latitude: number;
    longitude: number;
    radius: number;
    categories?: string[];
  }): string {
    const { latitude, longitude, radius, categories } = params;
    const lat = Math.round(latitude * 1000) / 1000;
    const lng = Math.round(longitude * 1000) / 1000;

    let key = `${this.PREFIXES.OVERPASS_SEARCH}${lat},${lng},${radius}`;
    if (categories && categories.length > 0) {
      key += `:${categories.sort().join(',')}`;
    }

    return key;
  }

  generateOverpassAreaKey(lat: number, lon: number, radiusKm: number): string {
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    return `${this.PREFIXES.OVERPASS_AREA}${roundedLat},${roundedLon},${radiusKm}`;
  }

  generateNominatimKey(
    category: string,
    bounds: {
      minLat: number;
      minLon: number;
      maxLat: number;
      maxLon: number;
    },
  ): string {
    const { minLat, minLon, maxLat, maxLon } = bounds;
    return `${this.PREFIXES.OVERPASS_NOMINATIM}${category}:${minLat.toFixed(2)},${minLon.toFixed(2)},${maxLat.toFixed(2)},${maxLon.toFixed(2)}`;
  }

  async hasNearbyCache(
    lat: number,
    lon: number,
    radius: number,
    marginKm: number = 0.5,
  ): Promise<string | null> {
    // Vérifier les clés proches (avec une marge)
    const nearbyKeys: string[] = [];
    const steps = [-1, 0, 1];

    for (const latStep of steps) {
      for (const lonStep of steps) {
        const checkLat = lat + latStep * 0.01; // ~1km
        const checkLon = lon + lonStep * 0.01;
        const key = this.generateOverpassAreaKey(checkLat, checkLon, radius);
        nearbyKeys.push(key);
      }
    }

    for (const key of nearbyKeys) {
      const cached = await this.get(key);
      if (cached) {
        this.logger.debug(`Found nearby cache: ${key}`);
        return key;
      }
    }

    return null;
  }

  /**
   * Intelligent cache
   */
  async getOrSetWithFreshness<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions & {
      maxAge?: number;
      fallbackOnError?: boolean;
    },
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== undefined) {
        return cached;
      }

      const value = await factory();

      await this.set(key, value, options);

      return value;
    } catch (error) {
      if (options?.fallbackOnError) {
        const cached = await this.get<T>(key);
        if (cached !== undefined) {
          this.logger.warn(`Using stale cache for ${key} due to error`);
          return cached;
        }
      }
      throw error;
    }
  }

  /**
   * Clean expire entry
   */
  async cleanup(): Promise<void> {
    this.logger.log('Cache cleanup requested');
    // Implementation depends on cache provider
    // For Redis, this would be handled automatically with TTL
  }

  /**
   * Obtain cache metrics
   */
  getMetrics(): {
    type: string;
    status: 'active' | 'inactive';
    entries?: number;
  } {
    return {
      type: 'memory',
      status: 'active',
    };
  }
}
