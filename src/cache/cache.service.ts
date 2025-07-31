import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface CacheOptions {
  ttl?: number; // Time to live en secondes
  prefix?: string; // Préfixe pour la clé
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  
  // Préfixes pour organiser le cache
  private readonly PREFIXES = {
    GOOGLE_PLACES_SEARCH: 'gp:search:',
    GOOGLE_PLACES_DETAILS: 'gp:details:',
    GOOGLE_PLACES_PHOTOS: 'gp:photos:',
    GOOGLE_PLACES_AUTOCOMPLETE: 'gp:autocomplete:',
    POINTS_SEARCH: 'points:search:',
    POINTS_DETAILS: 'points:details:',
  };

  // TTL par défaut pour chaque type de cache (en secondes)
  private readonly DEFAULT_TTL = {
    SEARCH: 3600, // 1 heure
    DETAILS: 86400, // 24 heures
    PHOTOS: 604800, // 7 jours
    AUTOCOMPLETE: 1800, // 30 minutes
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Obtenir une valeur du cache
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
   * Définir une valeur dans le cache
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
   * Supprimer une valeur du cache
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
      // Pour cache-manager v4, on doit utiliser del avec pattern
      // ou implémenter une logique personnalisée
      this.logger.warn('Cache RESET - Method not available in this version');
      // Alternative: garder une liste des clés et les supprimer une par une
    } catch (error) {
      this.logger.error('Error resetting cache:', error);
    }
  }

  /**
   * Générer une clé de cache pour les recherches Google Places
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

  /**
   * Générer une clé de cache pour les recherches de texte Google Places
   */
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
   * Générer une clé de cache pour l'autocomplétion
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

  /**
   * Générer une clé de cache pour les détails d'un lieu
   */
  generatePlaceDetailsKey(placeId: string): string {
    return `${this.PREFIXES.GOOGLE_PLACES_DETAILS}${placeId}`;
  }

  /**
   * Générer une clé de cache pour les photos
   */
  generatePhotoKey(photoReference: string, maxWidth: number): string {
    return `${this.PREFIXES.GOOGLE_PLACES_PHOTOS}${photoReference}:${maxWidth}`;
  }

  /**
   * Obtenir ou calculer une valeur (pattern cache-aside)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Essayer de récupérer du cache
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Si pas en cache, calculer la valeur
    const value = await factory();
    
    // Mettre en cache pour la prochaine fois
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * Invalider le cache pour une zone géographique
   */
  async invalidateAreaCache(latitude: number, longitude: number, radius: number): Promise<void> {
    // TODO: Implémenter l'invalidation par zone si nécessaire
    this.logger.debug(`Area cache invalidation requested for ${latitude},${longitude} radius ${radius}`);
  }

  /**
   * Obtenir les statistiques du cache
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    // TODO: Implémenter les statistiques si nécessaire
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
    };
  }
}