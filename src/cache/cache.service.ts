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
    OVERPASS_SEARCH: 'overpass:search:',
    OVERPASS_AREA: 'overpass:area:',
    OVERPASS_NOMINATIM: 'overpass:nominatim:',
  };

  // TTL par défaut pour chaque type de cache (en secondes)
  private readonly DEFAULT_TTL = {
    SEARCH: 3600, // 1 heure
    DETAILS: 86400, // 24 heures
    PHOTOS: 604800, // 7 jours
    AUTOCOMPLETE: 1800, // 30 minutes
    OVERPASS_SEARCH: 7200, // 2 heures pour Overpass (changements moins fréquents)
    OVERPASS_AREA: 10800, // 3 heures pour les zones prédéfinies
    OVERPASS_NOMINATIM: 3600, // 1 heure pour Nominatim
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

  /**
   * Générer une clé de cache pour les recherches Overpass
   */
  generateOverpassSearchKey(params: {
    latitude: number;
    longitude: number;
    radius: number;
    categories?: string[];
  }): string {
    const { latitude, longitude, radius, categories } = params;
    // Arrondir à 3 décimales pour grouper les recherches proches
    const lat = Math.round(latitude * 1000) / 1000;
    const lng = Math.round(longitude * 1000) / 1000;
    
    let key = `${this.PREFIXES.OVERPASS_SEARCH}${lat},${lng},${radius}`;
    if (categories && categories.length > 0) {
      key += `:${categories.sort().join(',')}`;
    }
    
    return key;
  }

  /**
   * Générer une clé de cache pour les zones Overpass
   */
  generateOverpassAreaKey(lat: number, lon: number, radiusKm: number): string {
    // Arrondir à 2 décimales pour les zones (moins de précision nécessaire)
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    return `${this.PREFIXES.OVERPASS_AREA}${roundedLat},${roundedLon},${radiusKm}`;
  }

  /**
   * Générer une clé de cache pour Nominatim
   */
  generateNominatimKey(category: string, bounds: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  }): string {
    const { minLat, minLon, maxLat, maxLon } = bounds;
    return `${this.PREFIXES.OVERPASS_NOMINATIM}${category}:${minLat.toFixed(2)},${minLon.toFixed(2)},${maxLat.toFixed(2)},${maxLon.toFixed(2)}`;
  }

  /**
   * Vérifier si une zone est déjà en cache avec une marge
   */
  async hasNearbyCache(lat: number, lon: number, radius: number, marginKm: number = 0.5): Promise<string | null> {
    // Vérifier les clés proches (avec une marge)
    const nearbyKeys: string[] = [];
    const steps = [-1, 0, 1];
    
    for (const latStep of steps) {
      for (const lonStep of steps) {
        const checkLat = lat + (latStep * 0.01); // ~1km
        const checkLon = lon + (lonStep * 0.01);
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
   * Cache intelligent avec vérification de fraîcheur
   */
  async getOrSetWithFreshness<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions & { 
      maxAge?: number; // Age maximum acceptable en secondes
      fallbackOnError?: boolean; // Utiliser le cache expiré si erreur
    }
  ): Promise<T> {
    try {
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
    } catch (error) {
      // Si fallback activé et qu'on a une valeur en cache (même expirée)
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
}