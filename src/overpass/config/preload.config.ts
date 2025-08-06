/**
 * Configuration for Overpass pre-loading and optimization
 * Adjust these values to control server load
 */

export const PRELOAD_CONFIG = {
  // Queue configuration
  queue: {
    maxSize: 50, // Maximum queue size (was unlimited)
    maxConcurrent: 3, // Max concurrent queries (was unlimited)
    minDelayMs: 2000, // Min delay between queries (was 1000)
    maxDelayMs: 30000, // Max delay when errors occur (was 10000)
    maxRetries: 2, // Max retries per query (was 3)
  },

  // Tile loading configuration
  tiles: {
    maxTilesToQueue: 5, // Max tiles to queue at once (was unlimited)
    maxTilesToFetchSync: 3, // Max tiles to fetch synchronously (was unlimited)
    tileCacheTTLDays: 7, // How long to cache tiles
    minCacheRatioForUpdate: 0.2, // Only update if cache ratio below this (was 0.5)
  },

  // Prefetching configuration
  prefetch: {
    enabled: false, // Enable/disable prefetching (was true)
    maxRadiusKm: 2, // Max radius for prefetch (was 10)
    directions: 4, // Number of directions to prefetch (N,S,E,W)
  },

  // Pre-computation configuration
  precompute: {
    enabled: false, // Enable/disable auto precomputation (was true)
    onStartup: false, // Precompute on service startup (was true)
    popularAreas: [
      { name: 'Paris Center', lat: 48.8566, lon: 2.3522, radiusKm: 2 },
      { name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, radiusKm: 1 },
    ],
    delayBetweenAreasMs: 10000, // Delay between area computations (was 5000)
  },

  // Health monitoring
  monitoring: {
    checkIntervalMs: 30000, // Health check interval (was 60000)
    queueWarningThreshold: 50, // Warn if queue > this (was 100)
    queueEmergencyThreshold: 100, // Emergency clear if > this
    failureRateWarning: 0.2, // Warn if failure rate > this (was 0.3)
  },

  // Rate limiting
  rateLimit: {
    backoffMultiplier: 2.0, // Exponential backoff multiplier (was 1.5)
    initialDelayMs: 2000, // Initial delay between requests
    maxServersToUse: 3, // Max number of Overpass servers to use
  },

  // Strategy selection
  strategy: {
    tileSizeThresholdKm: 5, // Use tiles if radius <= this (was flexible)
    hybridSizeThresholdKm: 20, // Use hybrid if radius <= this
    clusterSizeThresholdKm: 100, // Always use clusters above this
  },
};

/**
 * Get configuration based on environment
 */
export function getPreloadConfig() {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    // Production: most conservative settings
    return {
      ...PRELOAD_CONFIG,
      queue: {
        ...PRELOAD_CONFIG.queue,
        maxSize: 30,
        maxConcurrent: 2,
        minDelayMs: 3000,
      },
    };
  } else if (env === 'development') {
    // Development: slightly more aggressive
    return {
      ...PRELOAD_CONFIG,
      queue: {
        ...PRELOAD_CONFIG.queue,
        maxSize: 100,
        maxConcurrent: 5,
        minDelayMs: 1500,
      },
      prefetch: {
        ...PRELOAD_CONFIG.prefetch,
        enabled: true,
        maxRadiusKm: 5,
      },
    };
  }

  return PRELOAD_CONFIG;
}
