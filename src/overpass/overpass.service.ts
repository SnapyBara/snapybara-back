import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import { OverpassMonitorService } from './overpass-monitor.service';
import { OVERPASS_CONFIG } from './overpass.constants';

export interface OverpassPOI {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
  source: 'overpass' | 'nominatim' | 'cached';
}

interface CachedArea {
  lat: number;
  lon: number;
  radius: number;
  timestamp: Date;
  pois: OverpassPOI[];
}

@Injectable()
export class OverpassService {
  private readonly logger = new Logger(OverpassService.name);
  private currentServerIndex = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
    private readonly monitorService: OverpassMonitorService,
  ) {}

  /**
   * Recherche des POIs avec stratégie multi-sources et cache
   */
  async searchPOIs(
    lat: number,
    lon: number,
    radiusKm: number,
    categories?: string[],
  ): Promise<{
    data: OverpassPOI[];
    sources: {
      cached: number;
      overpass: number;
      nominatim: number;
    };
    executionTime: number;
  }> {
    const startTime = Date.now();

    // 1. Générer la clé de cache
    const cacheKey = this.cacheService.generateOverpassSearchKey({
      latitude: lat,
      longitude: lon,
      radius: radiusKm,
      categories,
    });

    // 2. Vérifier si on a un cache proche
    const nearbyCacheKey = await this.cacheService.hasNearbyCache(
      lat,
      lon,
      radiusKm,
    );
    if (nearbyCacheKey) {
      const nearbyCached =
        await this.cacheService.get<OverpassPOI[]>(nearbyCacheKey);
      if (nearbyCached) {
        this.logger.debug(`Using nearby cache: ${nearbyCacheKey}`);
        return {
          data: nearbyCached,
          sources: { cached: nearbyCached.length, overpass: 0, nominatim: 0 },
          executionTime: Date.now() - startTime,
        };
      }
    }

    // 3. Utiliser le cache intelligent avec fallback
    const result = await this.cacheService.getOrSetWithFreshness<{
      data: OverpassPOI[];
      sources: { cached: number; overpass: number; nominatim: number };
    }>(
      cacheKey,
      async () => {
        const searchResult = await this.parallelSearch(
          lat,
          lon,
          radiusKm,
          categories,
        );
        return searchResult;
      },
      {
        ttl: this.cacheService['DEFAULT_TTL'].OVERPASS_SEARCH,
        fallbackOnError: true, // Utiliser le cache expiré si erreur
      },
    );

    return {
      ...result,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Recherche parallèle sur plusieurs sources
   */
  private async parallelSearch(
    lat: number,
    lon: number,
    radiusKm: number,
    categories?: string[],
  ): Promise<{
    data: OverpassPOI[];
    sources: {
      cached: number;
      overpass: number;
      nominatim: number;
    };
  }> {
    // Pour les très grandes zones, retourner des clusters virtuels
    if (radiusKm > 50) {
      this.logger.log(
        `Very large area requested (${radiusKm}km), returning virtual clusters`,
      );
      return this.generateVirtualClusters(lat, lon, radiusKm);
    }

    // Limiter le rayon pour Overpass pour éviter les timeouts
    const effectiveRadiusKm = Math.min(
      radiusKm,
      OVERPASS_CONFIG.MAX_SEARCH_RADIUS_KM,
    );
    const radiusMeters = effectiveRadiusKm * 1000;
    const nominatimRadius = Math.min(effectiveRadiusKm, 2);

    this.logger.log(
      `Search requested for radius ${radiusKm}km, using effective radius ${effectiveRadiusKm}km`,
    );

    // Lancer les requêtes en parallèle avec gestion d'erreur robuste
    const searchPromises = [
      // Overpass avec timeout global
      Promise.race([
        this.queryOverpass(lat, lon, radiusMeters, categories).catch(
          (error) => {
            this.logger.error('Overpass query failed:', error.message);
            return [] as OverpassPOI[];
          },
        ),
        new Promise<OverpassPOI[]>((resolve) =>
          setTimeout(() => {
            this.logger.warn('Overpass global timeout reached (20s)');
            resolve([]);
          }, OVERPASS_CONFIG.GLOBAL_TIMEOUT_MS),
        ),
      ]),

      // Nominatim avec gestion d'erreur
      this.queryNominatim(lat, lon, nominatimRadius).catch((error) => {
        this.logger.error('Nominatim query failed:', error.message);
        return [] as OverpassPOI[];
      }),
    ];

    // Attendre toutes les promesses (avec gestion d'erreur intégrée)
    const [overpassResults, nominatimResults] =
      await Promise.all(searchPromises);

    const allPOIs: OverpassPOI[] = [];
    const sources = { cached: 0, overpass: 0, nominatim: 0 };

    // Ajouter les résultats Overpass
    if (overpassResults && overpassResults.length > 0) {
      allPOIs.push(...overpassResults);
      sources.overpass = overpassResults.length;
      this.logger.log(`Overpass returned ${overpassResults.length} POIs`);
    }

    // Ajouter les résultats Nominatim (avec déduplication)
    if (nominatimResults && nominatimResults.length > 0) {
      const newPOIs = this.deduplicatePOIs(allPOIs, nominatimResults);
      allPOIs.push(...newPOIs);
      sources.nominatim = newPOIs.length;
      this.logger.log(`Nominatim added ${newPOIs.length} unique POIs`);
    }

    // Si aucun résultat, essayer une recherche de secours
    if (allPOIs.length === 0) {
      this.logger.warn(
        'No results from primary sources, attempting fallback search',
      );
      const fallbackPOIs = await this.fallbackSearch(lat, lon, radiusKm);
      allPOIs.push(...fallbackPOIs);
      sources.overpass = fallbackPOIs.length;
    }

    // Trier par pertinence
    const sortedPOIs = this.sortByRelevance(allPOIs, lat, lon);

    return {
      data: sortedPOIs.slice(0, 100), // Limiter à 100 résultats
      sources,
    };
  }

  /**
   * Recherche de secours avec requête très simple
   */
  private async fallbackSearch(
    lat: number,
    lon: number,
    radiusKm: number,
  ): Promise<OverpassPOI[]> {
    try {
      const radiusMeters = Math.min(radiusKm, 3) * 1000; // Max 3km pour le fallback
      const bbox = this.calculateBBox(lat, lon, radiusMeters);

      // Requête très basique qui devrait toujours fonctionner
      const fallbackQuery = `
        [out:json][timeout:5];
        (
          node["name"]["tourism"](${bbox});
          node["name"]["historic"](${bbox});
          way["name"]["leisure"="park"](${bbox});
        );
        out center 10;
      `;

      const serverUrl = this.getNextServer();
      const response = await firstValueFrom(
        this.httpService.post(
          serverUrl,
          `data=${encodeURIComponent(fallbackQuery)}`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'SnapyBara-Backend/1.0',
            },
            timeout: 8000, // Timeout court
          },
        ),
      );

      const pois = this.parseOverpassResponse(response.data);
      this.logger.log(`Fallback search returned ${pois.length} POIs`);
      return pois;
    } catch (error) {
      this.logger.error('Fallback search also failed:', error.message);
      return [];
    }
  }

  /**
   * Générer des clusters virtuels pour les très grandes zones
   */
  private async generateVirtualClusters(
    centerLat: number,
    centerLon: number,
    radiusKm: number,
  ): Promise<{
    data: OverpassPOI[];
    sources: { cached: number; overpass: number; nominatim: number };
  }> {
    const clusters: OverpassPOI[] = [];

    // Créer une grille de zones populaires connues
    const knownAreas = [
      { name: 'Paris', lat: 48.8566, lon: 2.3522, importance: 10 },
      { name: 'Lyon', lat: 45.764, lon: 4.8357, importance: 8 },
      { name: 'Marseille', lat: 43.2965, lon: 5.3698, importance: 8 },
      { name: 'Toulouse', lat: 43.6047, lon: 1.4442, importance: 7 },
      { name: 'Nice', lat: 43.7102, lon: 7.262, importance: 7 },
      { name: 'Montpellier', lat: 43.6108, lon: 3.8767, importance: 6 },
      { name: 'Bordeaux', lat: 44.8378, lon: -0.5792, importance: 7 },
      { name: 'Strasbourg', lat: 48.5734, lon: 7.7521, importance: 6 },
    ];

    // Filtrer les zones dans le rayon demandé
    for (const area of knownAreas) {
      const distance = this.calculateDistance(
        centerLat,
        centerLon,
        area.lat,
        area.lon,
      );
      if (distance <= radiusKm) {
        clusters.push({
          id: `cluster-${area.name.toLowerCase()}`,
          name: `Zone ${area.name}`,
          type: 'area_cluster',
          lat: area.lat,
          lon: area.lon,
          tags: {
            cluster: 'true',
            estimated_points: (area.importance * 50).toString(),
            city: area.name,
          },
          source: 'overpass',
        });
      }
    }

    // Si aucune ville connue, créer une grille générique
    if (clusters.length === 0) {
      const gridSize = Math.min(radiusKm / 4, 50); // Grille adaptative
      const steps = 3; // 3x3 grille

      for (let i = -steps / 2; i <= steps / 2; i++) {
        for (let j = -steps / 2; j <= steps / 2; j++) {
          if (i === 0 && j === 0) continue; // Skip center

          const gridLat = centerLat + (i * gridSize) / 111;
          const gridLon =
            centerLon +
            (j * gridSize) / (111 * Math.cos((centerLat * Math.PI) / 180));

          clusters.push({
            id: `grid-${i}-${j}`,
            name: `Zone ${i + steps / 2 + 1}-${j + steps / 2 + 1}`,
            type: 'area_cluster',
            lat: gridLat,
            lon: gridLon,
            tags: {
              cluster: 'true',
              estimated_points: '?',
            },
            source: 'overpass',
          });
        }
      }
    }

    return {
      data: clusters,
      sources: { cached: 0, overpass: clusters.length, nominatim: 0 },
    };
  }

  /**
   * Requête Overpass optimisée avec retry et rotation des serveurs
   */
  private async queryOverpass(
    lat: number,
    lon: number,
    radiusMeters: number,
    categories?: string[],
  ): Promise<OverpassPOI[]> {
    // Pour les grandes zones, utiliser la stratégie de requêtes multiples
    if (radiusMeters > OVERPASS_CONFIG.SPLIT_STRATEGY_THRESHOLD_KM * 1000) {
      return this.queryOverpassSplitStrategy(
        lat,
        lon,
        radiusMeters,
        categories,
      );
    }

    // Pour les petites zones, requête unique avec retry
    return this.queryOverpassWithRetry(
      this.buildOptimizedQuery(lat, lon, radiusMeters, categories),
      OVERPASS_CONFIG.MAX_RETRIES,
      OVERPASS_CONFIG.RETRY_DELAY_MS,
    );
  }

  /**
   * Stratégie de requêtes multiples pour les grandes zones
   */
  private async queryOverpassSplitStrategy(
    lat: number,
    lon: number,
    radiusMeters: number,
    categories?: string[],
  ): Promise<OverpassPOI[]> {
    const bbox = this.calculateBBox(lat, lon, radiusMeters);

    // Définir des groupes de requêtes par catégorie
    const queryGroups = [
      // Groupe 1: Monuments et sites historiques (priorité haute)
      {
        name: 'historic',
        query: `[out:json][timeout:10];
                (node["historic"~"^(monument|memorial|castle|ruins|palace)$"]["name"](${bbox});
                 way["historic"~"^(monument|memorial|castle|ruins|palace)$"]["name"](${bbox}););
                out center;`,
        priority: 1,
      },

      // Groupe 2: Points de vue et attractions touristiques
      {
        name: 'tourism',
        query: `[out:json][timeout:10];
                (node["tourism"~"^(viewpoint|attraction|museum|artwork)$"](${bbox});
                 way["tourism"~"^(attraction|museum)$"]["name"](${bbox}););
                out center;`,
        priority: 2,
      },

      // Groupe 3: Parcs et espaces verts (limite de taille)
      {
        name: 'leisure',
        query: `[out:json][timeout:10];
                (way["leisure"~"^(park|garden)$"]["name"](${bbox});
                 node["leisure"="garden"]["name"](${bbox}););
                out center 30;`,
        priority: 3,
      },

      // Groupe 4: Architecture religieuse et infrastructure
      {
        name: 'infrastructure',
        query: `[out:json][timeout:10];
                (node["amenity"="place_of_worship"]["name"](${bbox});
                 way["man_made"="bridge"]["name"](${bbox});
                 node["man_made"="lighthouse"](${bbox});
                 node["amenity"="fountain"]["name"](${bbox}););
                out center;`,
        priority: 4,
      },

      // Groupe 5: Sites naturels
      {
        name: 'natural',
        query: `[out:json][timeout:10];
                (node["natural"~"^(peak|cliff|waterfall|beach)$"](${bbox});
                 way["natural"="beach"]["name"](${bbox}););
                out center;`,
        priority: 5,
      },
    ];

    // Exécuter les requêtes en parallèle avec gestion d'erreur indépendante
    const results = await Promise.allSettled(
      queryGroups.map(async (group) => {
        try {
          const pois = await this.queryOverpassWithRetry(group.query, 2, 3000);
          this.logger.log(
            `Query group '${group.name}' returned ${pois.length} POIs`,
          );
          return { group: group.name, pois, priority: group.priority };
        } catch (error) {
          this.logger.error(
            `Query group '${group.name}' failed:`,
            error.message,
          );
          return { group: group.name, pois: [], priority: group.priority };
        }
      }),
    );

    // Collecter et dédupliquer les résultats
    const allPOIs: OverpassPOI[] = [];
    const poiIds = new Set<string>();
    let successCount = 0;

    // Trier par priorité pour garder les POIs les plus importants en premier
    const sortedResults = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value)
      .sort((a, b) => a.priority - b.priority);

    for (const result of sortedResults) {
      if (result.pois.length > 0) {
        successCount++;
        for (const poi of result.pois) {
          if (!poiIds.has(poi.id)) {
            poiIds.add(poi.id);
            allPOIs.push(poi);
          }
        }
      }
    }

    this.logger.log(
      `Split strategy: ${successCount}/${queryGroups.length} queries succeeded, total ${allPOIs.length} unique POIs`,
    );

    // Si au moins une requête a réussi, on retourne les résultats
    if (allPOIs.length > 0) {
      return allPOIs;
    }

    // Si toutes les requêtes ont échoué, tenter une requête minimale
    this.logger.warn(
      'All split queries failed, attempting minimal fallback query',
    );
    return this.queryOverpassMinimal(lat, lon, radiusMeters);
  }

  /**
   * Requête Overpass avec retry automatique
   */
  private async queryOverpassWithRetry(
    query: string,
    maxRetries: number = OVERPASS_CONFIG.MAX_RETRIES,
    retryDelay: number = OVERPASS_CONFIG.RETRY_DELAY_MS,
  ): Promise<OverpassPOI[]> {
    let lastError: Error = new Error('No retry attempts were made');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const serverUrl = this.getNextServer();
      const startTime = this.monitorService.recordQueryStart(serverUrl);

      try {
        this.logger.debug(
          `Attempt ${attempt + 1}/${maxRetries} on ${serverUrl}`,
        );

        const response = await firstValueFrom(
          this.httpService.post(
            serverUrl,
            `data=${encodeURIComponent(query)}`,
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'SnapyBara-Backend/1.0',
              },
              timeout: OVERPASS_CONFIG.DEFAULT_TIMEOUT_MS,
            },
          ),
        );

        const pois = this.parseOverpassResponse(response.data);
        this.monitorService.recordQuerySuccess(
          serverUrl,
          startTime,
          pois.length,
        );

        if (attempt > 0) {
          this.logger.log(`Query succeeded on attempt ${attempt + 1}`);
        }
        return pois;
      } catch (error) {
        lastError = error;

        const isRateLimit =
          error.response?.status === 429 ||
          error.message?.includes('rate_limited');
        const isTimeout =
          error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';

        this.monitorService.recordQueryFailure(
          serverUrl,
          error,
          startTime,
          isRateLimit,
          isTimeout,
        );

        if (isRateLimit) {
          // Rate limit - attendre plus longtemps
          const waitTime =
            retryDelay *
            Math.pow(OVERPASS_CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt);
          this.logger.warn(
            `Rate limited on ${serverUrl}, waiting ${waitTime}ms before retry`,
          );

          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        } else if (isTimeout) {
          // Timeout - réessayer avec un délai plus court
          this.logger.warn(
            `Timeout on ${serverUrl}, attempt ${attempt + 1}/${maxRetries}`,
          );

          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        } else {
          // Autre erreur - log et continuer
          this.logger.error(`Error on ${serverUrl}:`, error.message);

          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay / 2));
          }
        }
      }
    }

    // Toutes les tentatives ont échoué
    this.logger.error(`All ${maxRetries} attempts failed for Overpass query`);
    throw lastError;
  }

  /**
   * Requête minimale de fallback
   */
  private async queryOverpassMinimal(
    lat: number,
    lon: number,
    radiusMeters: number,
  ): Promise<OverpassPOI[]> {
    const bbox = this.calculateBBox(lat, lon, radiusMeters);

    // Requête très simple pour au moins obtenir quelques résultats
    const minimalQuery = `
      [out:json][timeout:5];
      (
        node["tourism"="viewpoint"]["name"](${bbox});
        node["historic"="monument"]["name"](${bbox});
        way["leisure"="park"]["name"](${bbox});
      );
      out center 20;
    `;

    try {
      return await this.queryOverpassWithRetry(minimalQuery, 1, 2000);
    } catch (error) {
      this.logger.error('Even minimal query failed:', error.message);
      return [];
    }
  }

  /**
   * Calculer la bounding box
   */
  private calculateBBox(
    lat: number,
    lon: number,
    radiusMeters: number,
  ): string {
    const latDelta = radiusMeters / 111000;
    const lonDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

    return `${lat - latDelta},${lon - lonDelta},${lat + latDelta},${lon + lonDelta}`;
  }

  /**
   * Construction de requête optimisée pour les points d'intérêt photographiques
   */
  private buildOptimizedQuery(
    lat: number,
    lon: number,
    radiusMeters: number,
    categories?: string[],
  ): string {
    // Utiliser des boîtes englobantes pour la performance
    const latDelta = radiusMeters / 111000;
    const lonDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

    const bbox = `${lat - latDelta},${lon - lonDelta},${lat + latDelta},${lon + lonDelta}`;

    // Pour les grandes zones (>8km), utiliser une requête très limitée
    if (radiusMeters > 8000) {
      this.logger.log(
        `Large area detected (${radiusMeters / 1000}km), using limited query`,
      );
      return this.buildLimitedQuery(bbox, radiusMeters);
    }

    // Pour les zones moyennes (5-8km), requête intermédiaire
    if (radiusMeters > 5000) {
      return this.buildMediumQuery(bbox);
    }

    // Requête complète pour les petites zones (<5km)
    return `
      [out:json][timeout:20];
      (
        // Monuments et patrimoine historique
        node["historic"~"^(monument|memorial|castle|ruins|archaeological_site|manor|palace|fort|tower|city_gate|wayside_cross|wayside_shrine)$"](${bbox});
        way["historic"~"^(monument|memorial|castle|ruins|archaeological_site|manor|palace|fort|tower|city_gate)$"](${bbox});
        
        // Architecture religieuse
        node["amenity"="place_of_worship"](${bbox});
        way["amenity"="place_of_worship"](${bbox});
        
        // Parcs et espaces verts
        node["leisure"~"^(park|garden|nature_reserve)$"](${bbox});
        way["leisure"~"^(park|garden|nature_reserve)$"](${bbox});
        
        // Points de vue et sites naturels remarquables
        node["natural"~"^(peak|volcano|rock|stone|cliff|beach|waterfall)$"](${bbox});
        way["natural"~"^(beach|waterfall|cliff)$"](${bbox});
        
        // Tourisme et attractions
        node["tourism"~"^(attraction|viewpoint|artwork|museum|gallery|zoo|aquarium|theme_park)$"](${bbox});
        way["tourism"~"^(attraction|museum|gallery|zoo|aquarium|theme_park)$"](${bbox});
        
        // Ponts remarquables
        way["man_made"="bridge"]["bridge"!="no"](${bbox});
        
        // Phares
        node["man_made"="lighthouse"](${bbox});
        way["man_made"="lighthouse"](${bbox});
        
        // Fontaines
        node["amenity"="fountain"](${bbox});
        way["amenity"="fountain"](${bbox});
        
        // Places publiques
        way["place"="square"](${bbox});
        
        // Sites avec tag photo spécifique
        node["photo"](${bbox});
        way["photo"](${bbox});
      );
      out center;
    `;
  }

  /**
   * Requête de comptage pour les très grandes zones
   */
  private buildCountQuery(bbox: string): string {
    return `
      [out:json][timeout:10];
      (
        // Compter seulement les points majeurs
        node["tourism"~"^(viewpoint|museum|attraction)$"](${bbox});
        node["historic"~"^(monument|castle)$"](${bbox});
        way["leisure"="park"](${bbox});
      );
      out count;
    `;
  }

  /**
   * Requête limitée pour les zones moyennes-grandes (10-50km)
   */
  private buildLimitedQuery(bbox: string, radiusMeters: number): string {
    const timeout = radiusMeters > 30000 ? 15 : 20;
    return `
      [out:json][timeout:${timeout}];
      (
        // Seulement les POIs les plus importants avec nom
        node["tourism"~"^(viewpoint|museum|attraction)$"]["name"](${bbox});
        node["historic"~"^(monument|castle|memorial)$"]["name"](${bbox});
        way["historic"~"^(castle|monument)$"]["name"](${bbox});
        
        // Grands parcs seulement
        way["leisure"="park"]["name"](${bbox});
        
        // Sites religieux majeurs
        node["amenity"="place_of_worship"]["building"="cathedral"](${bbox});
        
        // Points de vue naturels nommés
        node["tourism"="viewpoint"]["name"](${bbox});
        node["natural"~"^(peak|waterfall)$"]["name"](${bbox});
        
        // Ponts et phares célèbres
        way["man_made"="bridge"]["name"](${bbox});
        node["man_made"="lighthouse"]["name"](${bbox});
      );
      out center 50;
    `;
  }

  /**
   * Requête intermédiaire pour les zones moyennes (5-10km)
   */
  private buildMediumQuery(bbox: string): string {
    return `
      [out:json][timeout:20];
      (
        // Monuments et sites historiques principaux
        node["historic"~"^(monument|memorial|castle|ruins|palace|fort)$"](${bbox});
        way["historic"~"^(monument|memorial|castle|ruins|palace)$"](${bbox});
        
        // Architecture religieuse importante
        node["amenity"="place_of_worship"]["tourism"="yes"](${bbox});
        node["amenity"="place_of_worship"]["building"~"^(cathedral|church|mosque|synagogue|temple)$"](${bbox});
        way["amenity"="place_of_worship"]["name"](${bbox});
        
        // Parcs et jardins principaux
        way["leisure"~"^(park|garden)$"]["name"](${bbox});
        way["leisure"="nature_reserve"](${bbox});
        
        // Points de vue et attractions touristiques
        node["tourism"~"^(viewpoint|attraction|museum|artwork)$"](${bbox});
        way["tourism"~"^(attraction|museum)$"](${bbox});
        
        // Sites naturels remarquables
        node["natural"~"^(peak|cliff|waterfall|beach)$"](${bbox});
        
        // Infrastructure photographique
        way["man_made"="bridge"]["name"](${bbox});
        node["man_made"="lighthouse"](${bbox});
        node["amenity"="fountain"]["name"](${bbox});
        way["place"="square"]["name"](${bbox});
      );
      out center 80;
    `;
  }

  /**
   * Requête Nominatim avec cache
   */
  private async queryNominatim(
    lat: number,
    lon: number,
    radiusKm: number,
  ): Promise<OverpassPOI[]> {
    const categories = ['tourism', 'historic', 'museum', 'viewpoint'];
    const results: OverpassPOI[] = [];

    // Définir les limites de recherche
    const bounds = {
      minLat: lat - 0.05,
      maxLat: lat + 0.05,
      minLon: lon - 0.05,
      maxLon: lon + 0.05,
    };

    // Requêtes séquentielles pour Nominatim (respecter rate limit)
    for (const category of categories) {
      try {
        // Générer la clé de cache pour cette catégorie
        const cacheKey = this.cacheService.generateNominatimKey(
          category,
          bounds,
        );

        // Utiliser le cache ou faire la requête
        const categoryResults = await this.cacheService.getOrSet<OverpassPOI[]>(
          cacheKey,
          async () => {
            const response = await firstValueFrom(
              this.httpService.get(
                'https://nominatim.openstreetmap.org/search',
                {
                  params: {
                    q: category,
                    format: 'json',
                    limit: 20,
                    viewbox: `${bounds.minLon},${bounds.maxLat},${bounds.maxLon},${bounds.minLat}`,
                    bounded: 1,
                    extratags: 1,
                  },
                  headers: {
                    'User-Agent': 'SnapyBara-Backend/1.0',
                  },
                  timeout: 5000,
                },
              ),
            );

            return this.parseNominatimResponse(response.data);
          },
          {
            ttl: this.cacheService['DEFAULT_TTL'].OVERPASS_NOMINATIM,
          },
        );

        results.push(...categoryResults);

        // Petit délai pour respecter le rate limit (seulement si pas depuis le cache)
        if (!categoryResults.length || categoryResults[0].source !== 'cached') {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        this.logger.warn(
          `Nominatim query failed for ${category}:`,
          error.message,
        );
      }
    }

    return results;
  }

  /**
   * Parser pour Overpass avec calcul du centre pour les zones
   */
  private parseOverpassResponse(data: any): OverpassPOI[] {
    const pois: OverpassPOI[] = [];

    // Si c'est une réponse de comptage
    if (
      data.elements &&
      data.elements.length === 1 &&
      data.elements[0].tags?.total
    ) {
      const count = parseInt(data.elements[0].tags.total);
      this.logger.log(`Count query returned: ${count} elements`);

      // Retourner un POI spécial pour indiquer qu'il y a trop de résultats
      if (count > 0) {
        return [
          {
            id: 'overpass-count-indicator',
            name: `Zone trop large: ${count} points`,
            type: 'count_indicator',
            lat: 0,
            lon: 0,
            tags: { count: count.toString() },
            source: 'overpass',
          },
        ];
      }
      return [];
    }

    if (!data.elements) return pois;

    for (const element of data.elements) {
      const name =
        element.tags?.name ||
        element.tags?.['name:fr'] ||
        element.tags?.['name:en'];

      // Pour les parcs, jardins et places, on peut être plus permissif sur le nom
      const isImportantArea =
        element.tags?.leisure === 'park' ||
        element.tags?.leisure === 'garden' ||
        element.tags?.place === 'square' ||
        element.tags?.natural === 'beach' ||
        element.tags?.tourism === 'attraction';

      // Ignorer seulement les éléments vraiment sans intérêt
      if (
        !name &&
        !isImportantArea &&
        !element.tags?.historic &&
        !element.tags?.tourism
      ) {
        continue;
      }

      let lat: number;
      let lon: number;

      // Calculer la position selon le type d'élément
      if (element.type === 'node') {
        lat = element.lat;
        lon = element.lon;
      } else if (element.type === 'way' || element.type === 'relation') {
        // Préférer le centre fourni par Overpass
        if (element.center) {
          lat = element.center.lat;
          lon = element.center.lon;
        } else if (element.bounds) {
          // Utiliser le centre des bounds
          lat = (element.bounds.minlat + element.bounds.maxlat) / 2;
          lon = (element.bounds.minlon + element.bounds.maxlon) / 2;
        } else if (element.geometry && element.geometry.length > 0) {
          // Calculer depuis la géométrie si disponible
          const coords = this.calculateCenterFromGeometry(element.geometry);
          lat = coords.lat;
          lon = coords.lon;
        } else {
          // Pas de position disponible
          this.logger.debug(
            `No position available for ${element.type}/${element.id}`,
          );
          continue;
        }
      } else {
        continue;
      }

      // Vérifier que les coordonnées sont valides
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      // Générer un nom approprié
      const poiName = name || this.generateAreaName(element.tags, element.type);

      const poi: OverpassPOI = {
        id: `overpass-${element.type}-${element.id}`,
        name: poiName,
        type: this.determineType(element.tags),
        lat,
        lon,
        tags: {
          ...element.tags,
          osm_type: element.type,
          osm_id: element.id.toString(),
        },
        source: 'overpass',
      };

      pois.push(poi);
    }

    this.logger.log(`Parsed ${pois.length} POIs from Overpass response`);
    return pois;
  }

  /**
   * Calculer le centre d'une géométrie
   */
  private calculateCenterFromGeometry(geometry: any[]): {
    lat: number;
    lon: number;
  } {
    if (!geometry || geometry.length === 0) {
      return { lat: 0, lon: 0 };
    }

    let sumLat = 0;
    let sumLon = 0;
    let count = 0;

    for (const point of geometry) {
      if (point.lat && point.lon) {
        sumLat += point.lat;
        sumLon += point.lon;
        count++;
      }
    }

    if (count === 0) {
      return { lat: 0, lon: 0 };
    }

    return {
      lat: sumLat / count,
      lon: sumLon / count,
    };
  }

  /**
   * Générer un nom pour les zones sans nom
   */
  private generateAreaName(
    tags: Record<string, string>,
    osmType: string,
  ): string {
    // Priorité aux tags les plus descriptifs
    if (tags.leisure === 'park') return tags.description || 'Parc';
    if (tags.leisure === 'garden') return tags.description || 'Jardin';
    if (tags.leisure === 'nature_reserve') return 'Réserve naturelle';
    if (tags.natural === 'wood' || tags.landuse === 'forest') return 'Bois';
    if (tags.natural === 'water') return "Plan d'eau";
    if (tags.natural === 'beach') return 'Plage';
    if (tags.natural === 'peak') return 'Sommet';
    if (tags.natural === 'cliff') return 'Falaise';
    if (tags.natural === 'waterfall') return 'Cascade';
    if (tags.place === 'square') return 'Place';
    if (tags.amenity === 'fountain') return 'Fontaine';
    if (tags.amenity === 'place_of_worship') {
      if (tags.religion === 'christian') return tags.denomination || 'Église';
      if (tags.religion === 'muslim') return 'Mosquée';
      if (tags.religion === 'jewish') return 'Synagogue';
      if (tags.religion === 'buddhist') return 'Temple bouddhiste';
      return 'Lieu de culte';
    }
    if (tags.historic === 'monument') return 'Monument';
    if (tags.historic === 'memorial') return 'Mémorial';
    if (tags.historic === 'castle') return 'Château';
    if (tags.historic === 'ruins') return 'Ruines';
    if (tags.historic === 'archaeological_site') return 'Site archéologique';
    if (tags.tourism === 'viewpoint') return 'Point de vue';
    if (tags.tourism === 'attraction') return 'Attraction touristique';
    if (tags.tourism === 'museum') return 'Musée';
    if (tags.tourism === 'artwork') return "Œuvre d'art";
    if (tags.man_made === 'lighthouse') return 'Phare';
    if (tags.man_made === 'bridge') return 'Pont';
    if (tags.building && tags.building !== 'yes') {
      const buildingType = tags.building.replace(/_/g, ' ');
      return buildingType.charAt(0).toUpperCase() + buildingType.slice(1);
    }

    // Utiliser d'autres tags descriptifs
    if (tags.description) return tags.description;
    if (tags['description:fr']) return tags['description:fr'];
    if (tags.alt_name) return tags.alt_name;
    if (tags.loc_name) return tags.loc_name;

    // Nom par défaut basé sur le type principal
    const mainTag =
      tags.leisure ||
      tags.natural ||
      tags.tourism ||
      tags.historic ||
      tags.amenity;
    if (mainTag) {
      return (
        mainTag.replace(/_/g, ' ').charAt(0).toUpperCase() +
        mainTag.slice(1).replace(/_/g, ' ')
      );
    }

    // Dernier recours
    return `Point d'intérêt`;
  }

  /**
   * Parser pour Nominatim
   */
  private parseNominatimResponse(data: any[]): OverpassPOI[] {
    return data
      .filter((item) => item.display_name && item.lat && item.lon)
      .map((item) => ({
        id: `nominatim-${item.osm_id}`,
        name: this.extractName(item.display_name),
        type: item.type || 'unknown',
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        tags: item.extratags || {},
        source: 'nominatim' as const,
      }));
  }

  /**
   * Déduplication par proximité
   */
  private deduplicatePOIs(
    existing: OverpassPOI[],
    newPOIs: OverpassPOI[],
    thresholdMeters: number = 50,
  ): OverpassPOI[] {
    return newPOIs.filter((newPOI) => {
      return !existing.some((existingPOI) => {
        const distance = this.calculateDistance(
          existingPOI.lat,
          existingPOI.lon,
          newPOI.lat,
          newPOI.lon,
        );
        return distance < thresholdMeters;
      });
    });
  }

  /**
   * Calcul de distance (formule de Haversine simplifiée)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Rayon de la Terre en mètres
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
   * Tri par pertinence
   */
  private sortByRelevance(
    pois: OverpassPOI[],
    userLat: number,
    userLon: number,
  ): OverpassPOI[] {
    return pois.sort((a, b) => {
      // Score basé sur plusieurs critères
      const scoreA = this.calculateRelevanceScore(a);
      const scoreB = this.calculateRelevanceScore(b);

      // En cas d'égalité, trier par distance
      if (scoreA === scoreB) {
        const distA = this.calculateDistance(userLat, userLon, a.lat, a.lon);
        const distB = this.calculateDistance(userLat, userLon, b.lat, b.lon);
        return distA - distB;
      }

      return scoreB - scoreA;
    });
  }

  /**
   * Calcul du score de pertinence pour les points photographiques
   */
  private calculateRelevanceScore(poi: OverpassPOI): number {
    let score = 0;

    // Bonus pour les données enrichies
    if (poi.tags.wikipedia || poi.tags.wikidata) score += 10;
    if (poi.tags.heritage) score += 15; // Plus de points pour le patrimoine
    if (poi.tags.tourism) score += 8;
    if (poi.tags.website) score += 3;
    if (poi.tags.opening_hours) score += 2;
    if (poi.tags.image || poi.tags.wikimedia_commons) score += 10; // Bonus important pour les images
    if (poi.tags.photo) score += 12; // Tag photo spécifique

    // Bonus par type (adapté pour les POI photographiques)
    const premiumTypes = [
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
      'waterfall',
      'cliff',
      'park',
      'garden', // Ajouter les parcs et jardins dans les types premium
    ];
    if (premiumTypes.includes(poi.type)) score += 10;

    // Bonus spécifique pour les espaces verts photographiques
    if (poi.tags.leisure === 'park' || poi.tags.leisure === 'garden') {
      score += 5;
      // Bonus supplémentaire pour les grands parcs connus
      if (poi.tags.name && poi.tags.name.length > 0) score += 3;
    }

    // Bonus supplémentaire pour certains tags spécifiques
    if (poi.tags.historic) score += 8;
    if (poi.tags['tourism:type'] === 'photo_spot') score += 15;
    if (poi.tags.scenic === 'yes') score += 10;
    if (poi.tags['instagram:ref']) score += 5; // Points Instagram populaires

    // Bonus pour les sites naturels photographiques
    if (
      poi.tags.natural &&
      ['peak', 'cliff', 'waterfall', 'beach'].includes(poi.tags.natural)
    ) {
      score += 8;
    }

    // Bonus pour les places publiques
    if (poi.tags.place === 'square') score += 6;

    // Pénalité pour les éléments sans nom uniquement s'ils ne sont pas des zones importantes
    const isImportantArea =
      poi.tags.leisure || poi.tags.place === 'square' || poi.tags.natural;
    if ((!poi.name || poi.name.trim() === '') && !isImportantArea) {
      score -= 10;
    }

    // Bonus pour la taille (si l'info est disponible)
    if (poi.tags.area && parseFloat(poi.tags.area) > 10000) score += 3; // Grandes zones

    return score;
  }

  /**
   * Rotation des serveurs Overpass avec sélection intelligente
   */
  private getNextServer(): string {
    // Utiliser le monitoring pour sélectionner le meilleur serveur
    const bestServer = this.monitorService.getBestServer(
      OVERPASS_CONFIG.SERVERS,
    );

    // Si un meilleur serveur est identifié, l'utiliser
    if (bestServer) {
      return bestServer;
    }

    // Sinon, rotation simple
    const server = OVERPASS_CONFIG.SERVERS[this.currentServerIndex];
    this.currentServerIndex =
      (this.currentServerIndex + 1) % OVERPASS_CONFIG.SERVERS.length;
    return server;
  }

  /**
   * Déterminer le type depuis les tags (optimisé pour les POI photographiques)
   */
  private determineType(tags: Record<string, string>): string {
    // Prioriser les types les plus spécifiques et photographiques
    if (tags.tourism) {
      if (['viewpoint', 'artwork', 'attraction'].includes(tags.tourism)) {
        return tags.tourism;
      }
    }

    if (tags.historic) {
      const historicTypes = [
        'monument',
        'memorial',
        'castle',
        'ruins',
        'archaeological_site',
        'manor',
        'palace',
        'fort',
        'tower',
        'city_gate',
      ];
      if (historicTypes.includes(tags.historic)) {
        return tags.historic;
      }
    }

    if (tags.natural) {
      const naturalTypes = [
        'peak',
        'volcano',
        'rock',
        'cliff',
        'beach',
        'waterfall',
      ];
      if (naturalTypes.includes(tags.natural)) {
        return tags.natural;
      }
    }

    if (tags.man_made === 'lighthouse') return 'lighthouse';
    if (tags.man_made === 'bridge' && tags.bridge !== 'no') return 'bridge';
    if (tags.amenity === 'fountain') return 'fountain';
    if (tags.amenity === 'place_of_worship') {
      if (tags.building === 'cathedral') return 'cathedral';
      if (tags.building === 'church') return 'church';
      if (tags.building === 'mosque') return 'mosque';
      if (tags.building === 'synagogue') return 'synagogue';
      if (tags.building === 'temple') return 'temple';
      return 'religious_building';
    }

    if (tags.leisure) {
      if (['park', 'garden', 'nature_reserve'].includes(tags.leisure)) {
        return tags.leisure;
      }
    }

    // Types génériques basés sur d'autres tags
    if (tags.tourism) return tags.tourism;
    if (tags.historic) return tags.historic;
    if (tags.building === 'cathedral' || tags.building === 'church')
      return tags.building;
    if (tags.natural) return tags.natural;
    if (tags.photo) return 'photo_spot';

    return 'other';
  }

  /**
   * Extraire un nom court depuis display_name Nominatim
   */
  private extractName(displayName: string): string {
    const parts = displayName.split(',');
    return parts[0].trim();
  }

  /**
   * Pré-charger une zone (pour les zones populaires)
   */
  async preloadArea(lat: number, lon: number, radiusKm: number): Promise<void> {
    this.logger.log(`Preloading area: ${lat}, ${lon}, radius: ${radiusKm}km`);

    try {
      // Utiliser une clé de cache spécifique pour les zones préchargées
      const areaKey = this.cacheService.generateOverpassAreaKey(
        lat,
        lon,
        radiusKm,
      );

      // Vérifier si déjà en cache
      const existing = await this.cacheService.get(areaKey);
      if (existing) {
        this.logger.log('Area already cached');
        return;
      }

      // Charger la zone avec un TTL plus long
      const result = await this.parallelSearch(lat, lon, radiusKm);
      await this.cacheService.set(areaKey, result.data, {
        ttl: this.cacheService['DEFAULT_TTL'].OVERPASS_AREA,
      });

      this.logger.log(
        `Area preloaded successfully: ${result.data.length} POIs`,
      );
    } catch (error) {
      this.logger.error('Failed to preload area:', error);
    }
  }

  /**
   * Pré-charger les zones populaires de Paris (sites photographiques)
   */
  async preloadPopularAreas(): Promise<void> {
    const popularAreas = [
      // Sites iconiques
      { name: 'Tour Eiffel', lat: 48.8584, lon: 2.2945, radius: 2 },
      { name: 'Louvre', lat: 48.8606, lon: 2.3376, radius: 2 },
      { name: 'Notre-Dame', lat: 48.853, lon: 2.3499, radius: 2 },
      { name: 'Arc de Triomphe', lat: 48.8738, lon: 2.295, radius: 1.5 },
      { name: 'Sacré-Cœur', lat: 48.8867, lon: 2.3431, radius: 1.5 },

      // Quartiers photographiques
      { name: 'Montmartre', lat: 48.8867, lon: 2.3431, radius: 2 },
      { name: 'Champs-Élysées', lat: 48.8698, lon: 2.3078, radius: 2 },
      { name: 'Quartier Latin', lat: 48.8463, lon: 2.3461, radius: 1.5 },
      { name: 'Marais', lat: 48.8566, lon: 2.3613, radius: 1.5 },
      { name: 'Trocadéro', lat: 48.862, lon: 2.2886, radius: 1 },

      // Sites avec vues panoramiques
      { name: 'Panthéon', lat: 48.8462, lon: 2.3464, radius: 1 },
      { name: 'Tour Montparnasse', lat: 48.8421, lon: 2.322, radius: 1 },
      { name: 'Buttes Chaumont', lat: 48.8789, lon: 2.383, radius: 1.5 },
      { name: 'Parc de Belleville', lat: 48.8701, lon: 2.3843, radius: 1 },

      // Ponts photographiques
      { name: 'Pont Alexandre III', lat: 48.8638, lon: 2.3135, radius: 0.5 },
      { name: 'Pont Neuf', lat: 48.8566, lon: 2.3415, radius: 0.5 },
      { name: 'Pont des Arts', lat: 48.8583, lon: 2.3375, radius: 0.5 },

      // Châteaux et palais
      { name: 'Château de Versailles', lat: 48.8049, lon: 2.1204, radius: 3 },
      { name: 'Château de Vincennes', lat: 48.8433, lon: 2.4378, radius: 2 },

      // Parcs et jardins
      { name: 'Luxembourg', lat: 48.8462, lon: 2.3372, radius: 1.5 },
      { name: 'Tuileries', lat: 48.8634, lon: 2.3275, radius: 1 },
      { name: 'Parc Monceau', lat: 48.8797, lon: 2.3088, radius: 1 },

      // Moderne
      { name: 'La Défense', lat: 48.8906, lon: 2.2419, radius: 2 },
      { name: 'Fondation Louis Vuitton', lat: 48.8766, lon: 2.2633, radius: 1 },
    ];

    for (const area of popularAreas) {
      this.logger.log(`Preloading popular photo area: ${area.name}`);
      await this.preloadArea(area.lat, area.lon, area.radius);
      // Attendre un peu entre chaque zone pour ne pas surcharger
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  /**
   * Réchauffer le cache périodiquement
   */
  async warmCache(): Promise<void> {
    this.logger.log('Starting cache warming...');

    try {
      // Précharger les zones populaires
      await this.preloadPopularAreas();

      this.logger.log('Cache warming completed');
    } catch (error) {
      this.logger.error('Cache warming failed:', error);
    }
  }
}
