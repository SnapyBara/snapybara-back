import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { OverpassPOI } from '../overpass.service';

export interface Tile {
  zoom: number;
  x: number;
  y: number;
}

export interface TileCache {
  tile: Tile;
  pois: OverpassPOI[];
  lastUpdated: Date;
  poiCount: number;
  importance: number; // 0-10 scale
}

@Injectable()
export class TileService {
  private readonly logger = new Logger(TileService.name);

  // Zoom levels:
  // 10: Country level (~150km tiles)
  // 12: Region level (~40km tiles)
  // 14: City level (~10km tiles)
  // 16: District level (~2.5km tiles)
  // 18: Neighborhood level (~600m tiles)
  private readonly DEFAULT_ZOOM_LEVELS = [10, 12, 14, 16, 18];

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Convert lat/lon to tile coordinates at given zoom level
   */
  getTileCoordinates(lat: number, lon: number, zoom: number): Tile {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
        n,
    );
    return { x, y, zoom };
  }

  /**
   * Get tile bounds in lat/lon
   */
  getTileBounds(tile: Tile): {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
    centerLat: number;
    centerLon: number;
  } {
    const n = Math.pow(2, tile.zoom);
    const minLon = (tile.x / n) * 360 - 180;
    const maxLon = ((tile.x + 1) / n) * 360 - 180;

    const minLat =
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + 1)) / n))) * 180) /
      Math.PI;
    const maxLat =
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n))) * 180) / Math.PI;

    return {
      minLat,
      maxLat,
      minLon,
      maxLon,
      centerLat: (minLat + maxLat) / 2,
      centerLon: (minLon + maxLon) / 2,
    };
  }

  /**
   * Get appropriate zoom level based on radius
   */
  getZoomForRadius(radiusKm: number): number {
    if (radiusKm <= 1) return 18; // Neighborhood
    if (radiusKm <= 5) return 16; // District
    if (radiusKm <= 20) return 14; // City
    if (radiusKm <= 80) return 12; // Region
    return 10; // Country
  }

  /**
   * Get all tiles that intersect with a circle
   */
  getTilesForArea(lat: number, lon: number, radiusKm: number): Tile[] {
    const zoom = this.getZoomForRadius(radiusKm);
    const tiles: Tile[] = [];

    // Calculate how many tiles we need to check
    const centerTile = this.getTileCoordinates(lat, lon, zoom);
    const tileSizeKm = this.getTileSizeKm(zoom, lat);
    const tilesRadius = Math.ceil(radiusKm / tileSizeKm);

    // Check surrounding tiles
    for (let dx = -tilesRadius; dx <= tilesRadius; dx++) {
      for (let dy = -tilesRadius; dy <= tilesRadius; dy++) {
        const tileX = centerTile.x + dx;
        const tileY = centerTile.y + dy;

        // Check if tile is valid
        const maxTile = Math.pow(2, zoom) - 1;
        if (tileX < 0 || tileX > maxTile || tileY < 0 || tileY > maxTile) {
          continue;
        }

        const tile = { x: tileX, y: tileY, zoom };
        const bounds = this.getTileBounds(tile);

        // Check if tile intersects with our circle
        if (this.tileIntersectsCircle(bounds, lat, lon, radiusKm)) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  /**
   * Calculate approximate tile size in km
   */
  private getTileSizeKm(zoom: number, lat: number): number {
    const earthCircumference = 40075; // km at equator
    const tileWidth =
      (earthCircumference * Math.cos((lat * Math.PI) / 180)) /
      Math.pow(2, zoom);
    return tileWidth;
  }

  /**
   * Check if a tile intersects with a circle
   */
  private tileIntersectsCircle(
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    centerLat: number,
    centerLon: number,
    radiusKm: number,
  ): boolean {
    // Simple approximation: check if any corner is within radius
    const corners = [
      { lat: bounds.minLat, lon: bounds.minLon },
      { lat: bounds.minLat, lon: bounds.maxLon },
      { lat: bounds.maxLat, lon: bounds.minLon },
      { lat: bounds.maxLat, lon: bounds.maxLon },
    ];

    for (const corner of corners) {
      const distance = this.calculateDistance(
        centerLat,
        centerLon,
        corner.lat,
        corner.lon,
      );
      if (distance <= radiusKm * 1000) {
        return true;
      }
    }

    // Also check if center is within bounds
    if (
      centerLat >= bounds.minLat &&
      centerLat <= bounds.maxLat &&
      centerLon >= bounds.minLon &&
      centerLon <= bounds.maxLon
    ) {
      return true;
    }

    return false;
  }

  /**
   * Calculate distance between two points (Haversine)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
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

  /**
   * Generate cache key for a tile
   */
  generateTileCacheKey(tile: Tile): string {
    return `tile:${tile.zoom}:${tile.x}:${tile.y}`;
  }

  /**
   * Get cache TTL based on tile importance and POI count
   */
  getTileCacheTTL(importance: number, poiCount: number): number {
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    // High importance areas (tourist zones)
    if (importance >= 8) {
      return 7 * day; // 1 week
    }

    // Medium importance with many POIs
    if (importance >= 5 && poiCount > 50) {
      return 3 * day; // 3 days
    }

    // Low density areas
    if (poiCount < 10) {
      return 30 * day; // 1 month
    }

    // Default
    return day; // 24 hours
  }

  /**
   * Calculate tile importance based on location
   */
  calculateTileImportance(tile: Tile, pois: OverpassPOI[]): number {
    const bounds = this.getTileBounds(tile);
    let importance = 0;

    // Major tourist areas in Paris
    const touristAreas = [
      { lat: 48.8584, lon: 2.2945, importance: 10 }, // Eiffel Tower
      { lat: 48.8606, lon: 2.3376, importance: 10 }, // Louvre
      { lat: 48.853, lon: 2.3499, importance: 9 }, // Notre-Dame
      { lat: 48.8738, lon: 2.295, importance: 9 }, // Arc de Triomphe
      { lat: 48.8867, lon: 2.3431, importance: 9 }, // Sacré-Cœur
      { lat: 48.8698, lon: 2.3078, importance: 8 }, // Champs-Élysées
      { lat: 48.8462, lon: 2.3464, importance: 7 }, // Panthéon
    ];

    // Check proximity to tourist areas
    for (const area of touristAreas) {
      if (
        area.lat >= bounds.minLat &&
        area.lat <= bounds.maxLat &&
        area.lon >= bounds.minLon &&
        area.lon <= bounds.maxLon
      ) {
        importance = Math.max(importance, area.importance);
      }
    }

    // Adjust based on POI quality
    const highValuePOIs = pois.filter(
      (poi) =>
        poi.tags.heritage ||
        poi.tags.wikipedia ||
        poi.type === 'viewpoint' ||
        poi.type === 'monument',
    ).length;

    if (highValuePOIs > 10) importance += 2;
    else if (highValuePOIs > 5) importance += 1;

    return Math.min(importance, 10);
  }

  /**
   * Store tile data in cache
   */
  async cacheTile(tile: Tile, pois: OverpassPOI[]): Promise<void> {
    const importance = this.calculateTileImportance(tile, pois);
    const ttl = this.getTileCacheTTL(importance, pois.length);

    const tileCache: TileCache = {
      tile,
      pois,
      lastUpdated: new Date(),
      poiCount: pois.length,
      importance,
    };

    const key = this.generateTileCacheKey(tile);
    await this.cacheService.set(key, tileCache, { ttl });

    this.logger.log(
      `Cached tile ${key} with ${pois.length} POIs, importance: ${importance}, TTL: ${ttl / 1000}s`,
    );
  }

  /**
   * Get POIs from cached tiles
   */
  async getPOIsFromTiles(tiles: Tile[]): Promise<{
    pois: OverpassPOI[];
    cachedTiles: Tile[];
    missingTiles: Tile[];
  }> {
    const allPOIs: OverpassPOI[] = [];
    const cachedTiles: Tile[] = [];
    const missingTiles: Tile[] = [];
    const seenPOIs = new Set<string>();

    for (const tile of tiles) {
      const key = this.generateTileCacheKey(tile);
      const cached = await this.cacheService.get<TileCache>(key);

      if (cached?.pois) {
        cachedTiles.push(tile);

        // Add POIs with deduplication
        for (const poi of cached.pois) {
          if (!seenPOIs.has(poi.id)) {
            seenPOIs.add(poi.id);
            allPOIs.push(poi);
          }
        }
      } else {
        missingTiles.push(tile);
      }
    }

    this.logger.log(
      `Tile cache hit: ${cachedTiles.length}/${tiles.length} tiles`,
    );

    return {
      pois: allPOIs,
      cachedTiles,
      missingTiles,
    };
  }

  /**
   * Precompute and cache important tiles
   */
  async precomputeImportantTiles(): Promise<void> {
    const importantAreas = [
      {
        name: 'Central Paris',
        lat: 48.8566,
        lon: 2.3522,
        radiusKm: 5,
        zoom: 14,
      },
      {
        name: 'Eiffel Tower Area',
        lat: 48.8584,
        lon: 2.2945,
        radiusKm: 2,
        zoom: 16,
      },
      { name: 'Louvre Area', lat: 48.8606, lon: 2.3376, radiusKm: 2, zoom: 16 },
      { name: 'Montmartre', lat: 48.8867, lon: 2.3431, radiusKm: 2, zoom: 16 },
    ];

    for (const area of importantAreas) {
      const tiles = this.getTilesForArea(area.lat, area.lon, area.radiusKm);
      this.logger.log(`Precomputing ${tiles.length} tiles for ${area.name}`);

      // Mark tiles for precomputation (actual loading done by OverpassService)
      for (const tile of tiles) {
        const key = `tile:precompute:${this.generateTileCacheKey(tile)}`;
        await this.cacheService.set(
          key,
          { area: area.name, priority: 10 },
          { ttl: 86400000 },
        );
      }
    }
  }
}
