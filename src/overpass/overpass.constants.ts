/**
 * Configuration et constantes pour l'API Overpass
 */

export const OVERPASS_CONFIG = {
  // Serveurs Overpass disponibles
  SERVERS: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
  ],

  // Limites de requêtes
  MAX_CONCURRENT_REQUESTS: 2,
  MIN_REQUEST_INTERVAL_MS: 1000,
  RATE_LIMIT_RETRY_DELAY_MS: 30000,

  // Timeouts
  DEFAULT_TIMEOUT_MS: 15000,
  MINIMAL_TIMEOUT_MS: 5000,
  GLOBAL_TIMEOUT_MS: 20000,

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  RETRY_BACKOFF_MULTIPLIER: 2,

  // Limites de zones
  MAX_SEARCH_RADIUS_KM: 8,
  SPLIT_STRATEGY_THRESHOLD_KM: 5,
  FALLBACK_MAX_RADIUS_KM: 3,

  // Limites de résultats
  MAX_POIS_PER_QUERY: 100,
  MAX_POIS_PER_GROUP: 30,
  MINIMAL_QUERY_LIMIT: 10,

  // Cache
  CACHE_GRID_SIZE: 0.01, // ~1km
};

/**
 * Types de POI prioritaires pour la photographie
 */
export const PHOTO_POI_TYPES = {
  HIGH_PRIORITY: [
    'viewpoint',
    'monument',
    'castle',
    'ruins',
    'lighthouse',
    'fountain',
    'cathedral',
    'palace',
    'archaeological_site',
    'memorial',
    'artwork',
    'bridge',
  ],

  MEDIUM_PRIORITY: [
    'park',
    'garden',
    'attraction',
    'museum',
    'church',
    'mosque',
    'synagogue',
    'temple',
    'square',
  ],

  LOW_PRIORITY: [
    'waterfall',
    'cliff',
    'beach',
    'peak',
    'nature_reserve',
    'religious_building',
    'other',
  ],
};

/**
 * Configuration des requêtes par groupe
 */
export const QUERY_GROUPS = {
  HISTORIC: {
    name: 'historic',
    timeout: 10,
    priority: 1,
    tags: [
      'monument',
      'memorial',
      'castle',
      'ruins',
      'palace',
      'archaeological_site',
      'manor',
      'fort',
    ],
  },

  TOURISM: {
    name: 'tourism',
    timeout: 10,
    priority: 2,
    tags: ['viewpoint', 'attraction', 'museum', 'artwork', 'gallery'],
  },

  LEISURE: {
    name: 'leisure',
    timeout: 10,
    priority: 3,
    tags: ['park', 'garden', 'nature_reserve'],
  },

  INFRASTRUCTURE: {
    name: 'infrastructure',
    timeout: 10,
    priority: 4,
    tags: ['place_of_worship', 'bridge', 'lighthouse', 'fountain'],
  },

  NATURAL: {
    name: 'natural',
    timeout: 10,
    priority: 5,
    tags: ['peak', 'cliff', 'waterfall', 'beach', 'volcano', 'rock'],
  },
};
