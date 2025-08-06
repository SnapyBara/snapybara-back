import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../cache/cache.service';
import { TileService, Tile } from './tile.service';
import { QueueService, QueryPriority, OverpassQuery } from './queue.service';
import { ClusterService, POICluster } from './cluster.service';
import { OverpassMonitorService } from '../overpass-monitor.service';
import { OVERPASS_CONFIG } from '../overpass.constants';
import { OverpassPOI, OverpassService } from '../overpass.service';

export interface OptimizedSearchResult {
  data: OverpassPOI[] | POICluster[];
  sources: {
    cached: number;
    overpass: number;
    nominatim: number;
    tiles: number;
    clusters: number;
  };
  executionTime: number;
  strategy: 'tiles' | 'clusters' | 'direct' | 'cached' | 'hybrid';
  cacheHit: boolean;
  metadata?: {
    tilesUsed?: number;
    tilesCached?: number;
    queryCount?: number;
  };
}

@Injectable()
export class OptimizedSearchService implements OnModuleInit {
  private readonly logger = new Logger(OptimizedSearchService.name);
  private serverIndex = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
    private readonly tileService: TileService,
    private readonly queueService: QueueService,
    private readonly clusterService: ClusterService,
    private readonly monitorService: OverpassMonitorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly overpassService: OverpassService, // For fallback
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Optimized Search Service');

    // Register event handlers
    this.setupEventHandlers();

    // DISABLED - Precompute important tiles only on demand
    // await this.precomputePopularAreas();
    this.logger.log('Skipping precomputation to reduce initial load');

    // Start monitoring
    this.startHealthMonitoring();
  }

  /**
   * Main optimized search method
   */
  async search(
    lat: number,
    lon: number,
    radiusKm: number,
    options?: {
      returnClusters?: boolean;
      forceStrategy?: 'tiles' | 'clusters' | 'direct' | 'hybrid';
      priority?: QueryPriority;
      maxResults?: number;
      categories?: string[];
    },
  ): Promise<OptimizedSearchResult> {
    const startTime = Date.now();

    // 1. Quick validation
    if (
      !this.validateCoordinates(lat, lon) ||
      radiusKm <= 0 ||
      radiusKm > 500
    ) {
      throw new Error('Invalid search parameters');
    }

    // 2. Check immediate cache
    const cacheKey = this.generateCacheKey(lat, lon, radiusKm, options);
    const cached = await this.checkCache(cacheKey);

    if (cached && this.isCacheFresh(cached, radiusKm)) {
      return {
        ...cached,
        executionTime: Date.now() - startTime,
        cacheHit: true,
        sources: {
          ...cached.sources,
          tiles: cached.sources.tiles || 0,
          clusters: cached.sources.clusters || 0,
        },
      };
    }

    // 3. Determine and execute strategy
    const strategy =
      options?.forceStrategy ||
      this.determineOptimalStrategy(radiusKm, options);
    this.logger.log(
      `Using ${strategy} strategy for ${radiusKm}km radius search`,
    );

    let result: OptimizedSearchResult;

    switch (strategy) {
      case 'tiles':
        result = await this.executeTileStrategy(lat, lon, radiusKm, options);
        break;

      case 'clusters':
        result = await this.executeClusterStrategy(lat, lon, radiusKm, options);
        break;

      case 'hybrid':
        result = await this.executeHybridStrategy(lat, lon, radiusKm, options);
        break;

      case 'direct':
      default:
        result = await this.executeDirectStrategy(lat, lon, radiusKm, options);
        break;
    }

    // 4. Post-process results
    result = await this.postProcessResults(result, lat, lon, radiusKm, options);

    // 5. Update cache
    await this.updateCache(cacheKey, result, strategy, radiusKm);

    // 6. Trigger background tasks
    this.triggerBackgroundTasks(lat, lon, radiusKm, result);

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Tile-based strategy for small to medium areas
   */
  private async executeTileStrategy(
    lat: number,
    lon: number,
    radiusKm: number,
    options?: any,
  ): Promise<OptimizedSearchResult> {
    const tiles = this.tileService.getTilesForArea(lat, lon, radiusKm);
    const { pois, cachedTiles, missingTiles } =
      await this.tileService.getPOIsFromTiles(tiles);

    this.logger.log(
      `Tile strategy: ${cachedTiles.length}/${tiles.length} tiles cached`,
    );

    // Handle missing tiles
    if (missingTiles.length > 0) {
      if (options?.priority === QueryPriority.CRITICAL) {
        // For critical requests, fetch at least some missing tiles
        const criticalTiles = missingTiles.slice(0, 3); // Limit to avoid timeout
        await this.fetchTilesSync(criticalTiles);

        // Re-fetch POIs including new tiles
        const updatedResult = await this.tileService.getPOIsFromTiles(tiles);
        pois.push(...updatedResult.pois);
      } else {
        // Queue missing tiles for background fetch
        this.queueMissingTiles(missingTiles, QueryPriority.HIGH);
      }
    }

    // Filter and process POIs
    const filteredPOIs = this.filterPOIsByDistance(pois, lat, lon, radiusKm);
    const dedupedPOIs = this.deduplicatePOIs(filteredPOIs);
    const sortedPOIs = this.sortPOIsByRelevance(dedupedPOIs, lat, lon);

    // Create clusters if requested
    if (options?.returnClusters && sortedPOIs.length > 30) {
      const zoom = this.tileService.getZoomForRadius(radiusKm);
      const clusters = this.clusterService.createClusters(sortedPOIs, zoom);

      return {
        data: clusters,
        sources: {
          cached: cachedTiles.length * 20, // Estimate
          overpass: missingTiles.length * 20,
          nominatim: 0,
          tiles: tiles.length,
          clusters: clusters.length,
        },
        executionTime: 0,
        strategy: 'tiles',
        cacheHit: false,
        metadata: {
          tilesUsed: tiles.length,
          tilesCached: cachedTiles.length,
        },
      };
    }

    return {
      data: sortedPOIs.slice(0, options?.maxResults || 100),
      sources: {
        cached: dedupedPOIs.length,
        overpass: 0,
        nominatim: 0,
        tiles: tiles.length,
        clusters: 0,
      },
      executionTime: 0,
      strategy: 'tiles',
      cacheHit: false,
      metadata: {
        tilesUsed: tiles.length,
        tilesCached: cachedTiles.length,
      },
    };
  }

  /**
   * Cluster strategy for large areas
   */
  private async executeClusterStrategy(
    lat: number,
    lon: number,
    radiusKm: number,
    options?: any,
  ): Promise<OptimizedSearchResult> {
    // For very large areas, use pre-computed or virtual clusters
    if (radiusKm > 100) {
      const virtualClusters = this.clusterService.generateVirtualClusters(
        lat,
        lon,
        radiusKm,
      );

      return {
        data: virtualClusters,
        sources: {
          cached: 0,
          overpass: 0,
          nominatim: 0,
          tiles: 0,
          clusters: virtualClusters.length,
        },
        executionTime: 0,
        strategy: 'clusters',
        cacheHit: false,
      };
    }

    // For medium-large areas, fetch sparse data and cluster
    const sparsePOIs = await this.fetchSparseData(lat, lon, radiusKm);
    const zoom = Math.max(10, 18 - Math.floor(Math.log2(radiusKm)));
    const clusters = this.clusterService.createClusters(sparsePOIs, zoom);

    return {
      data: clusters,
      sources: {
        cached: 0,
        overpass: sparsePOIs.length,
        nominatim: 0,
        tiles: 0,
        clusters: clusters.length,
      },
      executionTime: 0,
      strategy: 'clusters',
      cacheHit: false,
    };
  }

  /**
   * Hybrid strategy combining tiles and direct queries
   */
  private async executeHybridStrategy(
    lat: number,
    lon: number,
    radiusKm: number,
    options?: any,
  ): Promise<OptimizedSearchResult> {
    // Use tiles for center area
    const centerRadius = Math.min(radiusKm * 0.5, 5);
    const tileResult = await this.executeTileStrategy(
      lat,
      lon,
      centerRadius,
      options,
    );

    // Use sparse queries for outer area
    const outerPOIs = await this.fetchSparseData(
      lat,
      lon,
      radiusKm,
      centerRadius,
    );

    // Combine results
    const allPOIs = [
      ...(Array.isArray(tileResult.data) ? tileResult.data : []),
      ...outerPOIs,
    ];

    const dedupedPOIs = this.deduplicatePOIs(allPOIs as OverpassPOI[]);
    const sortedPOIs = this.sortPOIsByRelevance(dedupedPOIs, lat, lon);

    return {
      data: sortedPOIs.slice(0, options?.maxResults || 100),
      sources: {
        cached: tileResult.sources.cached,
        overpass: outerPOIs.length,
        nominatim: 0,
        tiles: tileResult.sources.tiles,
        clusters: 0,
      },
      executionTime: 0,
      strategy: 'hybrid',
      cacheHit: false,
    };
  }

  /**
   * Direct strategy - fallback to original implementation
   */
  private async executeDirectStrategy(
    lat: number,
    lon: number,
    radiusKm: number,
    options?: any,
  ): Promise<OptimizedSearchResult> {
    // Use existing OverpassService as fallback
    const result = await this.overpassService.searchPOIs(
      lat,
      lon,
      radiusKm,
      options?.categories,
    );

    return {
      data: result.data,
      sources: {
        cached: result.sources.cached,
        overpass: result.sources.overpass,
        nominatim: result.sources.nominatim,
        tiles: 0,
        clusters: 0,
      },
      executionTime: result.executionTime,
      strategy: 'direct',
      cacheHit: false,
    };
  }

  /**
   * Setup event handlers for queue processing
   */
  private setupEventHandlers() {
    // Handle query execution
    this.eventEmitter.on(
      'overpass.query.execute',
      async (query: OverpassQuery) => {
        try {
          await this.handleQueryExecution(query);
        } catch (error) {
          this.logger.error(`Query execution failed: ${query.id}`, error);
        }
      },
    );
  }

  /**
   * Handle query execution from queue
   */
  @OnEvent('overpass.query.execute')
  async handleQueryExecution(query: OverpassQuery): Promise<void> {
    switch (query.type) {
      case 'tile':
        await this.executeTileQuery(query);
        break;

      case 'area':
        await this.executeAreaQuery(query);
        break;

      case 'custom':
        await this.executeCustomQuery(query);
        break;
    }
  }

  /**
   * Execute tile query
   */
  private async executeTileQuery(query: OverpassQuery): Promise<void> {
    if (!query.tile) return;

    const bounds = this.tileService.getTileBounds(query.tile);
    const overpassQuery = this.buildTileQuery(bounds, query.tile.zoom);

    try {
      const pois = await this.executeOverpassQuery(overpassQuery);
      await this.tileService.cacheTile(query.tile, pois);

      this.logger.log(
        `Cached tile ${this.tileService.generateTileCacheKey(query.tile)} with ${pois.length} POIs`,
      );

      if (query.callback) {
        query.callback({ success: true, pois });
      }
    } catch (error) {
      this.logger.error(`Tile query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build optimized Overpass query for a tile
   */
  private buildTileQuery(
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    zoom: number,
  ): string {
    const bbox = `${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}`;

    // Adjust query complexity based on zoom level
    if (zoom >= 16) {
      // Street level - high detail
      return `
        [out:json][timeout:15];
        (
          node["tourism"](${bbox});
          node["historic"](${bbox});
          node["leisure"~"park|garden"](${bbox});
          node["amenity"~"place_of_worship|fountain"](${bbox});
          way["tourism"](${bbox});
          way["historic"](${bbox});
          way["leisure"~"park|garden"](${bbox});
          way["man_made"~"bridge|lighthouse"](${bbox});
        );
        out center;
      `;
    } else if (zoom >= 14) {
      // District level - medium detail
      return `
        [out:json][timeout:10];
        (
          node["tourism"]["name"](${bbox});
          node["historic"~"monument|memorial|castle"]["name"](${bbox});
          way["leisure"="park"]["name"](${bbox});
          way["tourism"="attraction"]["name"](${bbox});
        );
        out center 50;
      `;
    } else {
      // City/Region level - low detail, only major POIs
      return `
        [out:json][timeout:10];
        (
          node["tourism"="viewpoint"]["name"](${bbox});
          node["historic"~"castle|monument"]["name"]["wikipedia"](${bbox});
          way["leisure"="park"]["name"]["wikipedia"](${bbox});
        );
        out center 20;
      `;
    }
  }

  /**
   * Execute Overpass query with monitoring
   */
  private async executeOverpassQuery(query: string): Promise<OverpassPOI[]> {
    const serverUrl = this.getNextServer();
    const startTime = this.monitorService.recordQueryStart(serverUrl);

    try {
      const response = await firstValueFrom(
        this.httpService.post(serverUrl, `data=${encodeURIComponent(query)}`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SnapyBara-Backend/1.0',
          },
          timeout: OVERPASS_CONFIG.DEFAULT_TIMEOUT_MS,
        }),
      );

      const pois = this.parseOverpassResponse(response.data);
      this.monitorService.recordQuerySuccess(serverUrl, startTime, pois.length);

      return pois;
    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const isTimeout = error.code === 'ECONNABORTED';

      this.monitorService.recordQueryFailure(
        serverUrl,
        error,
        startTime,
        isRateLimit,
        isTimeout,
      );
      throw error;
    }
  }

  /**
   * Parse Overpass response
   */
  private parseOverpassResponse(data: any): OverpassPOI[] {
    if (!data.elements) return [];

    return data.elements
      .map((element) => {
        let lat: number, lon: number;

        if (element.type === 'node') {
          lat = element.lat;
          lon = element.lon;
        } else if (element.center) {
          lat = element.center.lat;
          lon = element.center.lon;
        } else {
          return null;
        }

        return {
          id: `${element.type}-${element.id}`,
          name: element.tags?.name || this.generateName(element.tags),
          type: this.determineType(element.tags),
          lat,
          lon,
          tags: element.tags || {},
          source: 'overpass' as const,
        };
      })
      .filter((poi) => poi !== null) as OverpassPOI[];
  }

  /**
   * Helper methods
   */
  private validateCoordinates(lat: number, lon: number): boolean {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  private generateCacheKey(
    lat: number,
    lon: number,
    radiusKm: number,
    options?: any,
  ): string {
    const rounded = {
      lat: Math.round(lat * 1000) / 1000,
      lon: Math.round(lon * 1000) / 1000,
      radius: Math.round(radiusKm * 10) / 10,
    };
    return `optimized:${rounded.lat}:${rounded.lon}:${rounded.radius}:${options?.returnClusters || false}`;
  }

  private async checkCache(key: string): Promise<OptimizedSearchResult | null> {
    const cached = await this.cacheService.get<OptimizedSearchResult>(key);
    return cached || null;
  }

  private isCacheFresh(cached: any, radiusKm: number): boolean {
    if (!cached.timestamp) return false;

    const age = Date.now() - cached.timestamp;
    const hour = 60 * 60 * 1000;

    // Different freshness for different radius sizes
    if (radiusKm <= 1) return age < 24 * hour; // 1 day for small areas
    if (radiusKm <= 10) return age < 3 * 24 * hour; // 3 days for medium
    if (radiusKm <= 50) return age < 7 * 24 * hour; // 1 week for large
    return age < 30 * 24 * hour; // 1 month for very large
  }

  private determineOptimalStrategy(
    radiusKm: number,
    options?: any,
  ): 'tiles' | 'clusters' | 'direct' | 'hybrid' {
    // If user wants clusters, use appropriate strategy
    if (options?.returnClusters) {
      return radiusKm > 20 ? 'clusters' : 'tiles';
    }

    // Small areas: use tiles for efficiency
    if (radiusKm <= 5) return 'tiles';

    // Medium areas: hybrid approach
    if (radiusKm <= 20) return 'hybrid';

    // Large areas: clusters to avoid overload
    if (radiusKm <= 100) return 'clusters';

    // Very large areas: always clusters
    return 'clusters';
  }

  private async fetchSparseData(
    lat: number,
    lon: number,
    radiusKm: number,
    excludeRadiusKm?: number,
  ): Promise<OverpassPOI[]> {
    const radiusMeters = radiusKm * 1000;
    const bbox = this.calculateBBox(lat, lon, radiusMeters);

    // Very selective query for sparse data
    const query = `
      [out:json][timeout:15];
      (
        node["tourism"~"viewpoint|museum"]["name"]["wikipedia"](${bbox});
        node["historic"~"castle|monument"]["name"]["heritage"](${bbox});
        way["leisure"="park"]["name"]["wikipedia"](${bbox});
      );
      out center 30;
    `;

    const pois = await this.executeOverpassQuery(query);

    // Filter out POIs in excluded radius if specified
    if (excludeRadiusKm) {
      return pois.filter((poi) => {
        const distance = this.calculateDistance(lat, lon, poi.lat, poi.lon);
        return distance > excludeRadiusKm * 1000;
      });
    }

    return pois;
  }

  private filterPOIsByDistance(
    pois: OverpassPOI[],
    lat: number,
    lon: number,
    radiusKm: number,
  ): OverpassPOI[] {
    const radiusMeters = radiusKm * 1000;
    return pois.filter((poi) => {
      const distance = this.calculateDistance(lat, lon, poi.lat, poi.lon);
      return distance <= radiusMeters;
    });
  }

  private deduplicatePOIs(pois: OverpassPOI[]): OverpassPOI[] {
    const seen = new Map<string, OverpassPOI>();

    for (const poi of pois) {
      const existing = seen.get(poi.id);
      if (
        !existing ||
        this.calculatePOIScore(poi) > this.calculatePOIScore(existing)
      ) {
        seen.set(poi.id, poi);
      }
    }

    return Array.from(seen.values());
  }

  private sortPOIsByRelevance(
    pois: OverpassPOI[],
    lat: number,
    lon: number,
  ): OverpassPOI[] {
    return pois.sort((a, b) => {
      const scoreA = this.calculatePOIScore(a);
      const scoreB = this.calculatePOIScore(b);

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // Secondary sort by distance
      const distA = this.calculateDistance(lat, lon, a.lat, a.lon);
      const distB = this.calculateDistance(lat, lon, b.lat, b.lon);

      return distA - distB;
    });
  }

  private calculatePOIScore(poi: OverpassPOI): number {
    let score = 0;

    // Quality indicators
    if (poi.tags.wikipedia || poi.tags.wikidata) score += 15;
    if (poi.tags.heritage) score += 20;
    if (poi.tags.website) score += 5;
    if (poi.tags.image || poi.tags.photo) score += 10;

    // Type scoring
    const premiumTypes = [
      'viewpoint',
      'monument',
      'castle',
      'museum',
      'cathedral',
      'lighthouse',
    ];
    if (premiumTypes.includes(poi.type)) score += 10;

    // Has name
    if (poi.name && poi.name.trim() && poi.name !== "Point d'intérêt")
      score += 5;

    return score;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateBBox(
    lat: number,
    lon: number,
    radiusMeters: number,
  ): string {
    const latDelta = radiusMeters / 111000;
    const lonDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));
    return `${lat - latDelta},${lon - lonDelta},${lat + latDelta},${lon + lonDelta}`;
  }

  private getNextServer(): string {
    const server = OVERPASS_CONFIG.SERVERS[this.serverIndex];
    this.serverIndex = (this.serverIndex + 1) % OVERPASS_CONFIG.SERVERS.length;
    return server;
  }

  private determineType(tags: Record<string, string>): string {
    if (tags.tourism) return tags.tourism;
    if (tags.historic) return tags.historic;
    if (tags.leisure) return tags.leisure;
    if (tags.amenity === 'place_of_worship') {
      if (tags.building === 'cathedral') return 'cathedral';
      if (tags.building === 'church') return 'church';
      return 'religious_building';
    }
    if (tags.man_made) return tags.man_made;
    if (tags.natural) return tags.natural;
    return 'other';
  }

  private generateName(tags: Record<string, string>): string {
    if (tags.leisure === 'park') return 'Parc';
    if (tags.leisure === 'garden') return 'Jardin';
    if (tags.tourism === 'viewpoint') return 'Point de vue';
    if (tags.historic === 'monument') return 'Monument';
    if (tags.amenity === 'fountain') return 'Fontaine';
    if (tags.man_made === 'lighthouse') return 'Phare';
    if (tags.man_made === 'bridge') return 'Pont';
    return "Point d'intérêt";
  }

  private async postProcessResults(
    result: OptimizedSearchResult,
    lat: number,
    lon: number,
    radiusKm: number,
    options?: any,
  ): Promise<OptimizedSearchResult> {
    // Add any post-processing logic here
    return result;
  }

  private async updateCache(
    key: string,
    result: OptimizedSearchResult,
    strategy: string,
    radiusKm: number,
  ): Promise<void> {
    const ttl = this.getCacheTTL(strategy, radiusKm, result.data.length);

    await this.cacheService.set(
      key,
      {
        ...result,
        timestamp: Date.now(),
      },
      { ttl },
    );
  }

  private getCacheTTL(
    strategy: string,
    radiusKm: number,
    resultCount: number,
  ): number {
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    // Strategy-based TTL
    if (strategy === 'clusters') return 7 * day; // Virtual clusters can be cached longer
    if (strategy === 'tiles') return 3 * day; // Tiles are pre-computed

    // Size-based TTL
    if (radiusKm > 50) return 7 * day; // Large areas change slowly
    if (radiusKm > 10) return 3 * day; // Medium areas
    if (resultCount < 10) return 30 * day; // Sparse areas rarely change

    return day; // Default 24 hours
  }

  private triggerBackgroundTasks(
    lat: number,
    lon: number,
    radiusKm: number,
    result: OptimizedSearchResult,
  ): void {
    // DISABLED - Prefetch adjacent areas only for small areas
    if (radiusKm <= 2) {
      // Reduced from 10 to 2
      this.queueService
        .prefetchArea(lat, lon, radiusKm)
        .catch((err) => this.logger.error('Prefetch failed:', err));
    }

    // Update tiles if needed - only if cache ratio is very low
    if (result.strategy === 'tiles' && result.metadata?.tilesUsed) {
      const cacheRatio =
        (result.metadata.tilesCached || 0) / result.metadata.tilesUsed;
      if (cacheRatio < 0.2) {
        // Reduced from 0.5 to 0.2
        this.logger.log(
          'Very low tile cache ratio, scheduling limited tile updates',
        );
        // Schedule only critical tiles
        const tilesUsed = result.metadata.tilesUsed;
        const tilesCached = result.metadata.tilesCached || 0;
        const missingTiles = Math.min(3, Math.max(0, tilesUsed - tilesCached));
        this.logger.log(`Will update ${missingTiles} tiles max`);
      }
    }
  }

  private async fetchTilesSync(tiles: Tile[]): Promise<void> {
    const promises = tiles.map((tile) => {
      const bounds = this.tileService.getTileBounds(tile);
      const query = this.buildTileQuery(bounds, tile.zoom);

      return this.executeOverpassQuery(query)
        .then((pois) => this.tileService.cacheTile(tile, pois))
        .catch((err) =>
          this.logger.error(`Failed to fetch tile sync: ${err.message}`),
        );
    });

    await Promise.all(promises);
  }

  private queueMissingTiles(tiles: Tile[], priority: QueryPriority): void {
    // Limit the number of tiles to queue
    const maxTilesToQueue = 5; // Limit to 5 tiles max
    const tilesToQueue = tiles.slice(0, maxTilesToQueue);

    if (tiles.length > maxTilesToQueue) {
      this.logger.warn(
        `Limiting tile queue from ${tiles.length} to ${maxTilesToQueue} tiles`,
      );
    }

    for (const tile of tilesToQueue) {
      const query: OverpassQuery = {
        id: `tile-${this.tileService.generateTileCacheKey(tile)}-${Date.now()}`,
        type: 'tile',
        tile,
        priority:
          priority === QueryPriority.CRITICAL
            ? QueryPriority.HIGH
            : QueryPriority.LOW, // Downgrade non-critical
        retries: 0,
        createdAt: new Date(),
      };

      this.queueService
        .enqueue(query)
        .catch((err) => this.logger.error('Failed to queue tile:', err));
    }
  }

  private async executeAreaQuery(query: OverpassQuery): Promise<void> {
    // Implementation similar to executeTileQuery but for areas
    if (!query.area) return;

    const { lat, lon, radius } = query.area;
    const result = await this.search(lat, lon, radius, {
      priority: query.priority,
    });

    if (query.callback) {
      query.callback(result);
    }
  }

  private async executeCustomQuery(query: OverpassQuery): Promise<void> {
    if (!query.query) return;

    const pois = await this.executeOverpassQuery(query.query);

    if (query.callback) {
      query.callback({ success: true, pois });
    }
  }

  /**
   * Precompute popular areas - ONLY ON MANUAL TRIGGER
   */
  async precomputePopularAreas(force: boolean = false): Promise<void> {
    if (!force) {
      this.logger.log('Precomputation skipped - manual trigger required');
      return;
    }

    this.logger.log('Precomputing popular areas (manually triggered)...');

    const popularAreas = [
      { name: 'Paris Center', lat: 48.8566, lon: 2.3522, radiusKm: 2 }, // Reduced from 5
      { name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, radiusKm: 1 }, // Reduced from 2
      // Removed other areas to reduce load
    ];

    for (const area of popularAreas) {
      try {
        await this.search(area.lat, area.lon, area.radiusKm, {
          priority: QueryPriority.LOW,
        });
        this.logger.log(`Precomputed ${area.name}`);
      } catch (error) {
        this.logger.error(`Failed to precompute ${area.name}:`, error);
      }

      // Wait longer between areas
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Increased from 5000
    }
  }

  /**
   * Health monitoring - WITH STRICTER THRESHOLDS
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      const metrics = this.queueService.getMetrics();

      if (metrics.queueLength > 50) {
        // Reduced from 100
        this.logger.warn(
          `Queue backlog: ${metrics.queueLength} queries pending`,
        );

        // Emergency queue clearing if too high
        if (metrics.queueLength > 100) {
          this.logger.error('EMERGENCY: Clearing LOW priority queries');
          // Clear low priority queries
          this.queueService.clearQueues();
        }
      }

      if (metrics.failedQueries / metrics.totalQueries > 0.2) {
        // Reduced from 0.3
        this.logger.error('High failure rate detected');
        this.queueService.adjustRateLimiting();
      }
    }, 30000); // Check every 30 seconds instead of every minute
  }

  /**
   * Scheduled tasks - REDUCED FREQUENCY
   */
  @Cron(CronExpression.EVERY_WEEK) // Changed from EVERY_DAY to EVERY_WEEK
  async performDailyMaintenance(): Promise<void> {
    this.logger.log('Starting weekly maintenance...');

    // Clean old cache entries
    await this.cacheService.cleanup();

    // DISABLED - Update popular areas only on demand
    // await this.precomputePopularAreas();
    this.logger.log('Skipping popular areas update');

    // Reset metrics
    this.monitorService.resetMetrics();

    this.logger.log('Weekly maintenance completed');
  }

  /**
   * Public API methods
   */
  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: any;
  }> {
    const queueMetrics = this.queueService.getMetrics();
    const monitorMetrics = this.monitorService.getAllMetrics();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (
      queueMetrics.queueLength > 200 ||
      queueMetrics.failedQueries / queueMetrics.totalQueries > 0.5
    ) {
      status = 'unhealthy';
    } else if (
      queueMetrics.queueLength > 100 ||
      queueMetrics.failedQueries / queueMetrics.totalQueries > 0.2
    ) {
      status = 'degraded';
    }

    return {
      status,
      metrics: {
        queue: queueMetrics,
        monitor: monitorMetrics,
      },
    };
  }

  async clearCache(): Promise<void> {
    await this.cacheService.reset();
    this.logger.log('Cache cleared');
  }

  async getQueueStatus(): Promise<any> {
    return this.queueService.getQueueStatus();
  }

  /**
   * Get service metrics
   */
  getMetrics(): any {
    return this.queueService.getMetrics();
  }
}
