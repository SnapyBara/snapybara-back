import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { OverpassPOI } from './overpass.service';

export interface POIPhoto {
  url: string;
  source: 'wikimedia' | 'unsplash' | 'placeholder';
  attribution?: string;
  width?: number;
  height?: number;
}

export interface EnrichedPOI extends OverpassPOI {
  photos: POIPhoto[];
  photoSearchTerms?: string[];
}

@Injectable()
export class PhotoEnrichmentService {
  private readonly logger = new Logger(PhotoEnrichmentService.name);
  private readonly unsplashAccessKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.unsplashAccessKey = this.configService.get<string>(
      'UNSPLASH_ACCESS_KEY',
      '',
    );
  }

  /**
   * Enrichit un POI avec des photos depuis Wikimedia et Unsplash
   */
  async enrichPOIWithPhotos(poi: OverpassPOI): Promise<EnrichedPOI> {
    this.logger.log(`=== ENRICHING POI WITH PHOTOS ===`);
    this.logger.log(`POI ID: ${poi.id}`);
    this.logger.log(`POI Name: ${poi.name}`);
    this.logger.log(`POI Type: ${poi.type}`);
    this.logger.log(`Coordinates: ${poi.lat}, ${poi.lon}`);
    this.logger.log(`Tags:`, poi.tags);

    const enrichedPOI: EnrichedPOI = {
      ...poi,
      photos: [],
      photoSearchTerms: this.generateSearchTerms(poi),
    };

    this.logger.log(`Search terms generated: ${enrichedPOI.photoSearchTerms}`);

    try {
      // 1. D'abord essayer Wikimedia Commons
      this.logger.log('Trying Wikimedia Commons...');
      const wikimediaPhotos = await this.getWikimediaPhotos(
        poi.lat,
        poi.lon,
        poi.name,
        poi.tags,
      );

      if (wikimediaPhotos.length > 0) {
        enrichedPOI.photos = wikimediaPhotos;
        this.logger.log(
          `✅ Found ${wikimediaPhotos.length} Wikimedia photos for ${poi.name}`,
        );
        this.logger.log(
          `Photos URLs: ${wikimediaPhotos.map((p) => p.url).join(', ')}`,
        );
        return enrichedPOI;
      }

      this.logger.log('❌ No Wikimedia photos found');

      // 2. Si pas de photos Wikimedia et Unsplash configuré, essayer Unsplash
      if (this.unsplashAccessKey && this.unsplashAccessKey !== '') {
        this.logger.log('Trying Unsplash...');
        const unsplashPhotos = await this.getUnsplashPhotos(
          poi.name,
          poi.type,
          poi.tags,
          enrichedPOI.photoSearchTerms,
        );

        if (unsplashPhotos.length > 0) {
          enrichedPOI.photos = unsplashPhotos;
          this.logger.log(
            `✅ Found ${unsplashPhotos.length} Unsplash photos for ${poi.name}`,
          );
          this.logger.log(
            `Photos URLs: ${unsplashPhotos.map((p) => p.url).join(', ')}`,
          );
          return enrichedPOI;
        }

        this.logger.log('❌ No Unsplash photos found');
      } else {
        this.logger.log('⚠️ Unsplash API key not configured');
      }

      // 3. Si toujours pas de photos, utiliser des placeholders
      this.logger.log('Using placeholder photos');
      enrichedPOI.photos = this.getPlaceholderPhotos(poi.name, poi.type);
      this.logger.log(
        `📷 Using ${enrichedPOI.photos.length} placeholder photos for ${poi.name}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error enriching POI with photos: ${poi.name}`,
        error,
      );
      enrichedPOI.photos = this.getPlaceholderPhotos(poi.name, poi.type);
    }

    this.logger.log(
      `=== END ENRICHMENT - Total photos: ${enrichedPOI.photos.length} ===`,
    );

    return enrichedPOI;
  }

  /**
   * Enrichit plusieurs POIs en parallèle
   */
  async enrichPOIsWithPhotos(pois: OverpassPOI[]): Promise<EnrichedPOI[]> {
    // Limiter le nombre de requêtes parallèles pour éviter de surcharger les APIs
    const batchSize = 5;
    const enrichedPOIs: EnrichedPOI[] = [];

    for (let i = 0; i < pois.length; i += batchSize) {
      const batch = pois.slice(i, i + batchSize);
      const enrichedBatch = await Promise.all(
        batch.map((poi) => this.enrichPOIWithPhotos(poi)),
      );
      enrichedPOIs.push(...enrichedBatch);

      // Petit délai entre les batches pour respecter les rate limits
      if (i + batchSize < pois.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return enrichedPOIs;
  }

  /**
   * Recherche de photos sur Wikimedia Commons
   */
  private async getWikimediaPhotos(
    lat: number,
    lon: number,
    name: string,
    tags: Record<string, string>,
  ): Promise<POIPhoto[]> {
    try {
      this.logger.log(`🔍 Searching Wikimedia photos for: ${name}`);

      // 1. Si on a un tag wikimedia_commons direct
      if (tags.wikimedia_commons) {
        this.logger.log(
          `Found wikimedia_commons tag: ${tags.wikimedia_commons}`,
        );
        const imageUrl = await this.getWikimediaImageUrl(
          tags.wikimedia_commons,
        );
        if (imageUrl) {
          return [
            {
              url: imageUrl,
              source: 'wikimedia',
              attribution: 'Wikimedia Commons',
            },
          ];
        }
      }

      // 2. Si on a un tag image direct
      if (tags.image) {
        this.logger.log(`Found image tag: ${tags.image}`);
        return [
          {
            url: tags.image,
            source: 'wikimedia',
            attribution: 'OpenStreetMap',
          },
        ];
      }

      // 3. Recherche par géolocalisation
      const radius = 500; // 500m de rayon
      const url =
        `https://commons.wikimedia.org/w/api.php?` +
        `action=query&format=json&` +
        `generator=geosearch&ggsprimary=all&ggsnamespace=6&` +
        `ggsradius=${radius}&ggscoord=${lat}|${lon}&ggslimit=5&` +
        `prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=800`;

      this.logger.log(
        `Searching by geolocation: ${lat}, ${lon} with radius ${radius}m`,
      );
      this.logger.log(`API URL: ${url}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent': 'SnapyBara-Backend/1.0',
          },
        }),
      );

      if (!response.data.query?.pages) {
        this.logger.log('No pages in Wikimedia response');
        return [];
      }

      const photos: POIPhoto[] = [];
      const pages = Object.values(response.data.query.pages);
      this.logger.log(`Found ${pages.length} pages in Wikimedia response`);

      for (const page of pages) {
        if (page.imageinfo?.[0]) {
          const info = page.imageinfo[0];
          photos.push({
            url: info.thumburl || info.url,
            source: 'wikimedia',
            attribution: 'Wikimedia Commons',
            width: info.thumbwidth || info.width,
            height: info.thumbheight || info.height,
          });
        }
      }

      this.logger.log(`Found ${photos.length} photos from Wikimedia`);

      return photos.slice(0, 3); // Limiter à 3 photos
    } catch (error) {
      this.logger.error('Error fetching Wikimedia photos:', error.message);
      return [];
    }
  }

  /**
   * Recherche de photos sur Unsplash
   */
  private async getUnsplashPhotos(
    name: string,
    type: string,
    tags: Record<string, string>,
    searchTerms?: string[],
  ): Promise<POIPhoto[]> {
    if (!this.unsplashAccessKey) {
      return [];
    }

    try {
      // Construire la requête de recherche
      const query = this.buildUnsplashQuery(name, type, tags, searchTerms);

      const url =
        `https://api.unsplash.com/search/photos?` +
        `query=${encodeURIComponent(query)}&` +
        `per_page=3&` +
        `orientation=landscape`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Client-ID ${this.unsplashAccessKey}`,
            'Accept-Version': 'v1',
          },
        }),
      );

      if (!response.data.results) {
        return [];
      }

      return response.data.results.map((photo: any) => ({
        url: photo.urls.regular,
        source: 'unsplash' as const,
        attribution: `Photo by ${photo.user.name} on Unsplash`,
        width: photo.width,
        height: photo.height,
      }));
    } catch (error) {
      this.logger.error('Error fetching Unsplash photos:', error);
      return [];
    }
  }

  /**
   * Construit une requête de recherche optimisée pour Unsplash
   */
  private buildUnsplashQuery(
    name: string,
    type: string,
    tags: Record<string, string>,
    searchTerms?: string[],
  ): string {
    const terms: string[] = [];

    // Utiliser les termes de recherche s'ils sont fournis
    if (searchTerms && searchTerms.length > 0) {
      return searchTerms[0];
    }

    // Sinon, construire une requête basée sur le type
    terms.push(name);

    // Ajouter la ville si disponible
    if (tags['addr:city']) {
      terms.push(tags['addr:city']);
    }

    // Ajouter des mots-clés selon le type
    const typeKeywords = this.getTypeKeywords(type, tags);
    if (typeKeywords) {
      terms.push(typeKeywords);
    }

    return terms.join(' ');
  }

  /**
   * Génère des termes de recherche pour un POI
   */
  private generateSearchTerms(poi: OverpassPOI): string[] {
    const terms: string[] = [poi.name];

    // Ajouter des variantes selon le type
    if (poi.tags['name:en']) {
      terms.push(poi.tags['name:en']);
    }

    // Ajouter le contexte géographique
    if (poi.tags['addr:city']) {
      terms.push(`${poi.name} ${poi.tags['addr:city']}`);
    }

    // Ajouter des termes spécifiques au type
    const typeSpecific = this.getTypeKeywords(poi.type, poi.tags);
    if (typeSpecific) {
      terms.push(`${poi.name} ${typeSpecific}`);
    }

    return terms;
  }

  /**
   * Retourne des mots-clés selon le type de POI
   */
  private getTypeKeywords(type: string, tags: Record<string, string>): string {
    const keywordMap: Record<string, string> = {
      viewpoint: 'panorama landscape view vista',
      monument: 'monument memorial historical',
      castle: 'castle fortress medieval chateau',
      church: 'church cathedral religious architecture',
      cathedral: 'cathedral church gothic architecture',
      museum: 'museum art gallery exhibition',
      fountain: 'fountain water square plaza',
      park: 'park garden nature green',
      garden: 'garden botanical plants flowers',
      bridge: 'bridge architecture river crossing',
      tower: 'tower architecture skyline tall',
      artwork: 'art sculpture statue public art',
      square: 'square plaza place public space',
      beach: 'beach sea ocean coast shore',
      waterfall: 'waterfall cascade water nature',
      mountain: 'mountain peak summit landscape',
      lake: 'lake water nature landscape',
    };

    // Vérifier d'abord le type direct
    if (keywordMap[type]) {
      return keywordMap[type];
    }

    // Vérifier les tags pour plus de contexte
    if (tags.tourism && keywordMap[tags.tourism]) {
      return keywordMap[tags.tourism];
    }

    if (tags.historic && keywordMap[tags.historic]) {
      return keywordMap[tags.historic];
    }

    if (tags.natural && keywordMap[tags.natural]) {
      return keywordMap[tags.natural];
    }

    // Par défaut pour les lieux photographiques
    return 'photography tourist attraction landmark';
  }

  /**
   * Convertit un nom de fichier Wikimedia en URL
   */
  private async getWikimediaImageUrl(filename: string): Promise<string | null> {
    try {
      // Nettoyer le nom de fichier
      const cleanFilename = filename
        .replace('File:', '')
        .replace('Image:', '')
        .replace(/ /g, '_');

      // Utiliser l'API pour obtenir l'URL
      const url =
        `https://commons.wikimedia.org/w/api.php?` +
        `action=query&format=json&` +
        `titles=File:${encodeURIComponent(cleanFilename)}&` +
        `prop=imageinfo&iiprop=url|size&iiurlwidth=800`;

      const response = await firstValueFrom(this.httpService.get(url));

      const pages = response.data.query.pages;
      const page = Object.values(pages)[0] as any;

      if (page.imageinfo?.[0]) {
        return page.imageinfo[0].thumburl || page.imageinfo[0].url;
      }

      return null;
    } catch (error) {
      this.logger.error('Error converting Wikimedia filename to URL:', error);
      return null;
    }
  }

  /**
   * Génère des photos placeholder
   */
  private getPlaceholderPhotos(name: string, type: string): POIPhoto[] {
    // Utiliser Lorem Picsum avec un seed basé sur le nom
    const seed = name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const categoryMap: Record<string, string> = {
      viewpoint: '1015', // Nature
      landscape: '1015',
      architecture: '1065',
      historical: '1051',
      beach: '1001',
      mountain: '1036',
      park: '1019',
      garden: '1019',
      church: '1065',
      cathedral: '1065',
      monument: '1051',
      museum: '1053',
    };

    const categoryId = categoryMap[type] || seed.toString();

    return [
      {
        url: `https://picsum.photos/seed/${categoryId}/800/600`,
        source: 'placeholder' as const,
        attribution: 'Lorem Picsum',
        width: 800,
        height: 600,
      },
      {
        url: `https://picsum.photos/seed/${categoryId}2/800/600`,
        source: 'placeholder' as const,
        attribution: 'Lorem Picsum',
        width: 800,
        height: 600,
      },
    ];
  }
}
