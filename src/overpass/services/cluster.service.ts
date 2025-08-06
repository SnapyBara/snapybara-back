import { Injectable, Logger } from '@nestjs/common';
import { OverpassPOI } from '../overpass.service';

export interface POICluster {
  id: string;
  centroid: { lat: number; lon: number };
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  poiCount: number;
  representativePOIs: OverpassPOI[]; // Top 3-5 POIs
  types: { [key: string]: number }; // Type distribution
  importance: number; // Cluster importance score
  radius: number; // Cluster radius in meters
}

@Injectable()
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);

  // Clustering parameters
  private readonly MIN_CLUSTER_SIZE = 5;
  private readonly MAX_CLUSTER_RADIUS_M = 500; // 500m clusters

  /**
   * Create clusters from POIs based on zoom level
   */
  createClusters(pois: OverpassPOI[], zoomLevel: number): POICluster[] {
    if (pois.length === 0) return [];

    // Determine cluster radius based on zoom
    const clusterRadius = this.getClusterRadius(zoomLevel);

    // Use DBSCAN-like clustering
    const clusters = this.dbscanClustering(pois, clusterRadius);

    // Convert to POICluster format
    return clusters.map((cluster, index) =>
      this.createClusterObject(cluster, index),
    );
  }

  /**
   * Get appropriate cluster radius for zoom level
   */
  private getClusterRadius(zoomLevel: number): number {
    if (zoomLevel >= 16) return 50; // 50m for street level
    if (zoomLevel >= 14) return 200; // 200m for district level
    if (zoomLevel >= 12) return 500; // 500m for city level
    if (zoomLevel >= 10) return 2000; // 2km for region level
    return 5000; // 5km for country level
  }

  /**
   * DBSCAN-like clustering algorithm
   */
  private dbscanClustering(
    pois: OverpassPOI[],
    radiusMeters: number,
  ): OverpassPOI[][] {
    const clusters: OverpassPOI[][] = [];
    const visited = new Set<string>();

    for (const poi of pois) {
      if (visited.has(poi.id)) continue;

      const neighbors = this.getNeighbors(poi, pois, radiusMeters);

      if (neighbors.length < this.MIN_CLUSTER_SIZE) {
        // Treat as noise or single point
        clusters.push([poi]);
        visited.add(poi.id);
      } else {
        // Start new cluster
        const cluster: OverpassPOI[] = [];
        const queue = [poi];

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current.id)) continue;

          visited.add(current.id);
          cluster.push(current);

          const currentNeighbors = this.getNeighbors(
            current,
            pois,
            radiusMeters,
          );
          for (const neighbor of currentNeighbors) {
            if (!visited.has(neighbor.id)) {
              queue.push(neighbor);
            }
          }
        }

        if (cluster.length > 0) {
          clusters.push(cluster);
        }
      }
    }

    return clusters;
  }

  /**
   * Get neighboring POIs within radius
   */
  private getNeighbors(
    center: OverpassPOI,
    pois: OverpassPOI[],
    radiusMeters: number,
  ): OverpassPOI[] {
    return pois.filter((poi) => {
      if (poi.id === center.id) return false;
      const distance = this.calculateDistance(
        center.lat,
        center.lon,
        poi.lat,
        poi.lon,
      );
      return distance <= radiusMeters;
    });
  }

  /**
   * Create cluster object from POI group
   */
  private createClusterObject(pois: OverpassPOI[], index: number): POICluster {
    // Calculate centroid
    let sumLat = 0,
      sumLon = 0;
    let minLat = 90,
      maxLat = -90;
    let minLon = 180,
      maxLon = -180;

    for (const poi of pois) {
      sumLat += poi.lat;
      sumLon += poi.lon;
      minLat = Math.min(minLat, poi.lat);
      maxLat = Math.max(maxLat, poi.lat);
      minLon = Math.min(minLon, poi.lon);
      maxLon = Math.max(maxLon, poi.lon);
    }

    const centroid = {
      lat: sumLat / pois.length,
      lon: sumLon / pois.length,
    };

    // Calculate type distribution
    const types: { [key: string]: number } = {};
    for (const poi of pois) {
      types[poi.type] = (types[poi.type] || 0) + 1;
    }

    // Select representative POIs (highest scoring)
    const sortedPOIs = [...pois].sort(
      (a, b) => this.calculatePOIScore(b) - this.calculatePOIScore(a),
    );
    const representativePOIs = sortedPOIs.slice(0, 5);

    // Calculate cluster importance
    const importance = this.calculateClusterImportance(pois, types);

    // Calculate cluster radius
    let maxDistance = 0;
    for (const poi of pois) {
      const distance = this.calculateDistance(
        centroid.lat,
        centroid.lon,
        poi.lat,
        poi.lon,
      );
      maxDistance = Math.max(maxDistance, distance);
    }

    return {
      id: `cluster-${index}-${Date.now()}`,
      centroid,
      bounds: { minLat, maxLat, minLon, maxLon },
      poiCount: pois.length,
      representativePOIs,
      types,
      importance,
      radius: maxDistance,
    };
  }

  /**
   * Calculate POI score for selection
   */
  private calculatePOIScore(poi: OverpassPOI): number {
    let score = 0;

    // Heritage and tourism value
    if (poi.tags.heritage) score += 20;
    if (poi.tags.wikipedia || poi.tags.wikidata) score += 15;
    if (poi.tags.tourism) score += 10;

    // Type-based scoring
    const premiumTypes = [
      'viewpoint',
      'monument',
      'castle',
      'museum',
      'cathedral',
    ];
    if (premiumTypes.includes(poi.type)) score += 15;

    // Has name
    if (poi.name && poi.name.trim()) score += 5;

    // Photo-specific tags
    if (poi.tags.image || poi.tags.photo) score += 10;

    return score;
  }

  /**
   * Calculate cluster importance
   */
  private calculateClusterImportance(
    pois: OverpassPOI[],
    types: { [key: string]: number },
  ): number {
    let importance = 0;

    // Size factor
    if (pois.length > 50) importance += 3;
    else if (pois.length > 20) importance += 2;
    else if (pois.length > 10) importance += 1;

    // Diversity factor
    const typeCount = Object.keys(types).length;
    if (typeCount > 5) importance += 2;
    else if (typeCount > 3) importance += 1;

    // Quality factor
    const highQualityPOIs = pois.filter(
      (poi) =>
        poi.tags.heritage || poi.tags.wikipedia || poi.type === 'viewpoint',
    ).length;

    if (highQualityPOIs > 10) importance += 3;
    else if (highQualityPOIs > 5) importance += 2;
    else if (highQualityPOIs > 2) importance += 1;

    return Math.min(importance, 10);
  }

  /**
   * Merge nearby clusters
   */
  mergeClusters(
    clusters: POICluster[],
    maxDistanceMeters: number,
  ): POICluster[] {
    const merged: POICluster[] = [];
    const used = new Set<string>();

    for (let i = 0; i < clusters.length; i++) {
      if (used.has(clusters[i].id)) continue;

      const cluster = clusters[i];
      const toMerge = [cluster];
      used.add(cluster.id);

      // Find nearby clusters
      for (let j = i + 1; j < clusters.length; j++) {
        if (used.has(clusters[j].id)) continue;

        const distance = this.calculateDistance(
          cluster.centroid.lat,
          cluster.centroid.lon,
          clusters[j].centroid.lat,
          clusters[j].centroid.lon,
        );

        if (distance <= maxDistanceMeters) {
          toMerge.push(clusters[j]);
          used.add(clusters[j].id);
        }
      }

      // Merge if multiple clusters found
      if (toMerge.length > 1) {
        merged.push(this.mergeClusterGroup(toMerge));
      } else {
        merged.push(cluster);
      }
    }

    return merged;
  }

  /**
   * Merge a group of clusters
   */
  private mergeClusterGroup(clusters: POICluster[]): POICluster {
    let totalPOIs = 0;
    let sumLat = 0,
      sumLon = 0;
    let minLat = 90,
      maxLat = -90;
    let minLon = 180,
      maxLon = -180;
    const allTypes: { [key: string]: number } = {};
    const allRepresentatives: OverpassPOI[] = [];

    for (const cluster of clusters) {
      totalPOIs += cluster.poiCount;
      sumLat += cluster.centroid.lat * cluster.poiCount;
      sumLon += cluster.centroid.lon * cluster.poiCount;

      minLat = Math.min(minLat, cluster.bounds.minLat);
      maxLat = Math.max(maxLat, cluster.bounds.maxLat);
      minLon = Math.min(minLon, cluster.bounds.minLon);
      maxLon = Math.max(maxLon, cluster.bounds.maxLon);

      // Merge types
      for (const [type, count] of Object.entries(cluster.types)) {
        allTypes[type] = (allTypes[type] || 0) + count;
      }

      // Collect representatives
      allRepresentatives.push(...cluster.representativePOIs);
    }

    // Sort and select top representatives
    const sortedReps = allRepresentatives.sort(
      (a, b) => this.calculatePOIScore(b) - this.calculatePOIScore(a),
    );
    const uniqueReps = Array.from(
      new Map(sortedReps.map((poi) => [poi.id, poi])).values(),
    ).slice(0, 5);

    const centroid = {
      lat: sumLat / totalPOIs,
      lon: sumLon / totalPOIs,
    };

    // Calculate new radius
    const radius = Math.max(
      this.calculateDistance(centroid.lat, centroid.lon, minLat, minLon),
      this.calculateDistance(centroid.lat, centroid.lon, maxLat, maxLon),
    );

    return {
      id: `merged-cluster-${Date.now()}`,
      centroid,
      bounds: { minLat, maxLat, minLon, maxLon },
      poiCount: totalPOIs,
      representativePOIs: uniqueReps,
      types: allTypes,
      importance: Math.max(...clusters.map((c) => c.importance)),
      radius,
    };
  }

  /**
   * Calculate distance between two points
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
   * Generate virtual clusters for very large areas
   */
  generateVirtualClusters(
    lat: number,
    lon: number,
    radiusKm: number,
  ): POICluster[] {
    const clusters: POICluster[] = [];

    // Known photo hotspots in France
    const photoHotspots = [
      {
        name: 'Paris - Tour Eiffel',
        lat: 48.8584,
        lon: 2.2945,
        importance: 10,
        count: 150,
      },
      {
        name: 'Paris - Louvre',
        lat: 48.8606,
        lon: 2.3376,
        importance: 10,
        count: 120,
      },
      {
        name: 'Paris - Montmartre',
        lat: 48.8867,
        lon: 2.3431,
        importance: 9,
        count: 100,
      },
      {
        name: 'Versailles',
        lat: 48.8049,
        lon: 2.1204,
        importance: 9,
        count: 80,
      },
      {
        name: 'Mont-Saint-Michel',
        lat: 48.6361,
        lon: -1.5115,
        importance: 10,
        count: 90,
      },
      {
        name: 'Nice - Promenade',
        lat: 43.6942,
        lon: 7.2653,
        importance: 8,
        count: 70,
      },
      {
        name: 'Lyon - Fourvière',
        lat: 45.7626,
        lon: 4.8226,
        importance: 8,
        count: 60,
      },
      {
        name: 'Carcassonne',
        lat: 43.2065,
        lon: 2.3641,
        importance: 8,
        count: 65,
      },
      { name: 'Annecy', lat: 45.8992, lon: 6.1294, importance: 7, count: 55 },
      { name: 'Colmar', lat: 48.0778, lon: 7.3556, importance: 7, count: 50 },
    ];

    // Filter hotspots within radius
    for (const spot of photoHotspots) {
      const distance =
        this.calculateDistance(lat, lon, spot.lat, spot.lon) / 1000; // km
      if (distance <= radiusKm) {
        clusters.push({
          id: `virtual-${spot.name.toLowerCase().replace(/\s+/g, '-')}`,
          centroid: { lat: spot.lat, lon: spot.lon },
          bounds: {
            minLat: spot.lat - 0.01,
            maxLat: spot.lat + 0.01,
            minLon: spot.lon - 0.01,
            maxLon: spot.lon + 0.01,
          },
          poiCount: spot.count,
          representativePOIs: [],
          types: {
            viewpoint: Math.floor(spot.count * 0.3),
            monument: Math.floor(spot.count * 0.3),
            museum: Math.floor(spot.count * 0.2),
            park: Math.floor(spot.count * 0.2),
          },
          importance: spot.importance,
          radius: 1000,
        });
      }
    }

    return clusters;
  }
}
