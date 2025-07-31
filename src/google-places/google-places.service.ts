import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutocompletePrediction, AutocompleteQueryDto, AutocompleteResponseDto } from './dto/autocomplete.dto';

// Interfaces pour la nouvelle API Places (v1)
interface PlaceV1 {
  name?: string;
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  photos?: Array<{
    name: string;
    widthPx?: number;
    heightPx?: number;
  }>;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  priceLevel?: string;
  businessStatus?: string;
  id?: string;
}

// Interfaces pour l'ancienne API (compatibilité)
interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
  };
  formatted_phone_number?: string;
  website?: string;
  price_level?: number;
  business_status?: string;
}

interface GooglePlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  business_status?: string;
  price_level?: number;
}

interface NearbySearchParams {
  latitude: number;
  longitude: number;
  radius?: number; // en mètres, max 50000
  type?: string;
  keyword?: string;
}

interface TextSearchParams {
  query: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly apiKey: string | null;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api/place';
  private readonly newApiUrl = 'https://places.googleapis.com/v1';

  constructor(private configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('GOOGLE_PLACES_API_KEY') || null;
    if (!this.apiKey) {
      this.logger.warn(
        'Google Places API key not configured - Google Places features will be disabled',
      );
    }
  }

  /**
   * Convertir un lieu de la nouvelle API vers l'ancien format
   */
  private convertV1ToLegacyFormat(place: PlaceV1): GooglePlaceSearchResult {
    // Extraire l'ID du nom de la ressource (format: places/PLACE_ID)
    const placeId = place.name?.replace('places/', '') || place.id || '';
    
    return {
      place_id: placeId,
      name: place.displayName?.text || '',
      formatted_address: place.formattedAddress || '',
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
      },
      types: place.types || [],
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      photos: place.photos?.map((photo, index) => ({
        photo_reference: photo.name || `photo_${index}`,
        height: photo.heightPx || 0,
        width: photo.widthPx || 0,
      })),
      business_status: place.businessStatus,
      price_level: this.convertPriceLevel(place.priceLevel),
    };
  }

  /**
   * Convertir le niveau de prix de la nouvelle API vers l'ancien format
   */
  private convertPriceLevel(priceLevel?: string): number | undefined {
    if (!priceLevel) return undefined;
    
    const priceLevelMap: Record<string, number> = {
      'PRICE_LEVEL_FREE': 0,
      'PRICE_LEVEL_INEXPENSIVE': 1,
      'PRICE_LEVEL_MODERATE': 2,
      'PRICE_LEVEL_EXPENSIVE': 3,
      'PRICE_LEVEL_VERY_EXPENSIVE': 4,
    };
    
    return priceLevelMap[priceLevel];
  }

  /**
   * Mapper les types de l'ancienne API vers la nouvelle
   */
  private mapToNewApiTypes(type?: string): string[] {
    if (!type) return ['tourist_attraction'];
    
    // Mapping des types les plus courants
    const typeMapping: Record<string, string> = {
      'museum': 'museum',
      'park': 'park',
      'restaurant': 'restaurant',
      'church': 'church',
      'tourist_attraction': 'tourist_attraction',
      'point_of_interest': 'tourist_attraction',
      'natural_feature': 'natural_feature',
      'establishment': 'establishment',
    };
    
    return [typeMapping[type] || 'tourist_attraction'];
  }

  /**
   * Types Google Places à exclure (commerces non pertinents)
   */
  private readonly EXCLUDED_TYPES = [
    'accounting',
    'atm',
    'bank',
    'car_dealer',
    'car_rental',
    'car_repair',
    'car_wash',
    'convenience_store',
    'dentist',
    'doctor',
    'drugstore',
    'electrician',
    'electronics_store',
    'finance',
    'gas_station',
    'grocery_or_supermarket',
    'gym',
    'hair_care',
    'hardware_store',
    'health',
    'home_goods_store',
    'hospital',
    'insurance_agency',
    'laundry',
    'lawyer',
    'locksmith',
    'lodging',
    'meal_delivery',
    'meal_takeaway',
    'moving_company',
    'painter',
    'pharmacy',
    'physiotherapist',
    'plumber',
    'post_office',
    'real_estate_agency',
    'roofing_contractor',
    'shoe_store',
    'shopping_mall',
    'spa',
    'store',
    'supermarket',
    'taxi_stand',
    'travel_agency',
    'veterinary_care'
  ];

  /**
   * Filtre les résultats pour exclure les points non pertinents
   */
  private filterRelevantPlaces(places: any[]): any[] {
    return places.filter(place => {
      // Exclure si tous les types sont dans la liste d'exclusion
      const hasOnlyExcludedTypes = place.types?.every((type: string) => 
        this.EXCLUDED_TYPES.includes(type)
      );
      
      // Garder si au moins un type n'est pas exclu
      return !hasOnlyExcludedTypes;
    });
  }

  /**
   * Filtre les résultats avec une approche plus inclusive pour les lieux naturels
   */
  private filterRelevantPlacesWithNature(places: any[]): any[] {
    // Types de lieux naturels et touristiques à toujours inclure
    const NATURE_AND_TOURIST_TYPES = [
      'tourist_attraction',
      'natural_feature',
      'park',
      'hiking_area',
      'campground',
      'national_park',
      'scenic_point',
      'mountain',
      'hill',
      'lake',
      'river',
      'waterfall',
      'beach',
      'forest',
      'viewpoint',
      'landmark',
      'point_of_interest',
      'establishment', // Inclure establishment car beaucoup de lieux naturels ont ce type
    ];

    return places.filter(place => {
      // Si le nom contient des mots-clés naturels, l'inclure
      const nameLower = place.displayName?.text?.toLowerCase() || place.name?.toLowerCase() || '';
      const natureNameKeywords = ['pic', 'mont', 'vue', 'viewpoint', 'panorama', 'belvédère',
                                   'cascade', 'lac', 'parc', 'jardin', 'nature', 'site'];
      
      if (natureNameKeywords.some(keyword => nameLower.includes(keyword))) {
        this.logger.debug(`Including place "${place.displayName?.text || place.name}" based on name keywords`);
        return true;
      }
      
      // Toujours inclure si le lieu a un type naturel ou touristique
      const hasNatureOrTouristType = place.types?.some((type: string) => 
        NATURE_AND_TOURIST_TYPES.includes(type)
      );
      
      if (hasNatureOrTouristType) {
        return true;
      }
      
      // Sinon, exclure si tous les types sont dans la liste d'exclusion
      const hasOnlyExcludedTypes = place.types?.every((type: string) => 
        this.EXCLUDED_TYPES.includes(type)
      );
      
      return !hasOnlyExcludedTypes;
    });
  }

  /**
   * Recherche de lieux à proximité avec la nouvelle API
   */
  async nearbySearch(
    params: NearbySearchParams,
  ): Promise<GooglePlaceSearchResult[]> {
    if (!this.apiKey) {
      this.logger.warn(
        'Google Places API key not configured, returning empty results',
      );
      return [];
    }

    try {
      const { latitude, longitude, radius = 5000, type, keyword } = params;

      // Validation du rayon - Google Places accepte entre 0 et 50000 mètres
      const safeRadius = Math.max(1, Math.min(radius || 5000, 50000));

      const url = `${this.newApiUrl}/places:searchNearby`;

      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.name,places.id,places.displayName,places.location,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.photos,places.businessStatus,places.priceLevel',
      };

      const body: any = {
        locationRestriction: {
          circle: {
            center: {
              latitude,
              longitude,
            },
            radius: safeRadius,
          },
        },
        maxResultCount: 20, // Augmenter pour avoir plus de résultats
      };

      // Pour obtenir des lieux naturels, inclure spécifiquement ces types
      const natureTypes = [
        'tourist_attraction',
        'park',
        'hiking_area',
        'campground',
        'national_park'
        // Note: 'natural_feature' et 'scenic_point' ne sont pas supportés par la nouvelle API
      ];

      // Si pas de type spécifique, chercher les attractions touristiques et lieux naturels
      if (!type) {
        body.includedTypes = natureTypes;
      } else {
        body.includedTypes = this.mapToNewApiTypes(type);
      }

      this.logger.debug(
        `Making new Places API nearby search request to: ${url} with radius: ${safeRadius}m, types: ${JSON.stringify(body.includedTypes)}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        this.logger.error(
          `Google Places API (New) error: ${data.error.message}`,
        );
        return [];
      }

      // Convertir les résultats vers l'ancien format
      const places = data.places || [];
      
      // Appliquer un filtre moins restrictif pour les lieux naturels
      const filteredPlaces = this.filterRelevantPlacesWithNature(places);
      
      return filteredPlaces.map((place: PlaceV1) => this.convertV1ToLegacyFormat(place));
    } catch (error) {
      this.logger.error('Error during nearby search:', error);
      return [];
    }
  }

  /**
   * Recherche textuelle de lieux avec la nouvelle API
   */
  async textSearch(
    params: TextSearchParams,
  ): Promise<GooglePlaceSearchResult[]> {
    if (!this.apiKey) {
      this.logger.warn(
        'Google Places API key not configured, returning empty results',
      );
      return [];
    }

    try {
      const { query, latitude, longitude, radius } = params;

      const url = `${this.newApiUrl}/places:searchText`;

      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.name,places.id,places.displayName,places.location,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.photos,places.businessStatus,places.priceLevel',
      };

      const body: any = {
        textQuery: query,
        maxResultCount: 20, // Augmenter pour avoir plus de résultats
      };

      // Ajouter une restriction de localisation si les coordonnées sont fournies
      if (latitude && longitude && radius) {
        // Validation du rayon - Google Places accepte entre 0 et 50000 mètres
        const safeRadius = Math.max(1, Math.min(radius || 5000, 50000));
        
        body.locationBias = {
          circle: {
            center: {
              latitude,
              longitude,
            },
            radius: safeRadius,
          },
        };

        this.logger.debug(
          `Text search with location bias - radius: ${safeRadius}m`,
        );
      }

      // Si pas de requête spécifique, inclure les types de lieux naturels
      if (!query || query.length < 3) {
        body.includedTypes = [
          'tourist_attraction',
          'natural_feature',
          'park',
          'hiking_area',
          'scenic_point'
        ];
      }

      this.logger.debug(
        `Making new Places API text search request to: ${url}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        this.logger.error(
          `Google Places API (New) error: ${data.error.message}`,
        );
        return [];
      }

      // Convertir les résultats vers l'ancien format
      const places = data.places || [];
      
      // Utiliser le filtre plus inclusif pour les lieux naturels
      const filteredPlaces = this.filterRelevantPlacesWithNature(places);
      
      return filteredPlaces.map((place: PlaceV1) => this.convertV1ToLegacyFormat(place));
    } catch (error) {
      this.logger.error('Error during text search:', error);
      return [];
    }
  }

  /**
   * Obtenir les détails d'un lieu spécifique avec la nouvelle API
   */
  async getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
    if (!this.apiKey) {
      this.logger.warn('Google Places API key not configured, returning null');
      return null;
    }

    try {
      // La nouvelle API utilise le format "places/PLACE_ID"
      const resourceName = placeId.startsWith('places/') 
        ? placeId 
        : `places/${placeId}`;
      
      const url = `${this.newApiUrl}/${resourceName}`;

      const headers = {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'name,id,displayName,location,formattedAddress,types,rating,userRatingCount,photos,currentOpeningHours,nationalPhoneNumber,websiteUri,priceLevel,businessStatus',
      };

      this.logger.debug(
        `Making new Places API details request to: ${url}`,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const place = await response.json();

      if (place.error) {
        this.logger.error(
          `Google Places API (New) error: ${place.error.message}`,
        );
        return null;
      }

      // Convertir vers l'ancien format avec les détails supplémentaires
      const legacyFormat = this.convertV1ToLegacyFormat(place);
      
      return {
        ...legacyFormat,
        opening_hours: place.currentOpeningHours ? {
          open_now: place.currentOpeningHours.openNow || false,
          weekday_text: place.currentOpeningHours.weekdayDescriptions || [],
        } : undefined,
        formatted_phone_number: place.nationalPhoneNumber,
        website: place.websiteUri,
      };
    } catch (error) {
      this.logger.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Obtenir l'URL d'une photo de lieu
   * Note: La nouvelle API utilise un système différent pour les photos
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    if (!this.apiKey || !photoReference) {
      return '';
    }

    // Si c'est une référence de la nouvelle API (format: places/*/photos/*)
    if (photoReference.includes('places/') && photoReference.includes('/photos/')) {
      return `${this.newApiUrl}/${photoReference}/media?maxWidthPx=${maxWidth}&key=${this.apiKey}`;
    }
    
    // Sinon, utiliser l'ancien format (compatibilité)
    return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  /**
   * Convertir un lieu Google Places en format compatible avec notre schéma
   */
  convertToPointOfInterest(
    googlePlace: GooglePlaceSearchResult | GooglePlaceDetails,
  ): Partial<any> {
    // D'abord mapper les catégories basées sur les types Google
    const categoriesFromTypes = this.mapGoogleTypesToOurCategories(googlePlace.types);
    
    // Ensuite, affiner la catégorie basée sur le nom du lieu
    const refinedCategory = this.refineCategoryByName(
      googlePlace.name, 
      categoriesFromTypes[0] || 'other',
      googlePlace.types
    );

    // Log pour debug
    if (googlePlace.types.some(t => ['tourist_attraction', 'point_of_interest', 'establishment'].includes(t))) {
      this.logger.debug(`Converting place "${googlePlace.name}" - types: ${googlePlace.types.join(', ')}, initial category: ${categoriesFromTypes[0] || 'other'}, refined category: ${refinedCategory}`);
    }

    return {
      name: googlePlace.name,
      description: '', // Google Places n'a pas de description détaillée
      latitude: googlePlace.geometry.location.lat,
      longitude: googlePlace.geometry.location.lng,
      category: refinedCategory,
      address: {
        formattedAddress: googlePlace.formatted_address,
      },
      metadata: {
        googlePlaceId: googlePlace.place_id,
        googleTypes: googlePlace.types,
        rating: googlePlace.rating,
        userRatingsTotal: googlePlace.user_ratings_total,
        photos: googlePlace.photos?.slice(0, 3)?.map((photo) => ({ // Limiter à 3 photos
          reference: photo.photo_reference,
          height: photo.height,
          width: photo.width,
          url: this.getPhotoUrl(photo.photo_reference),
        })),
        businessStatus: (googlePlace as GooglePlaceDetails).business_status,
        website: (googlePlace as GooglePlaceDetails).website,
        phoneNumber: (googlePlace as GooglePlaceDetails).formatted_phone_number,
        priceLevel: googlePlace.price_level,
        source: 'google_places',
      },
      statistics: {
        averageRating: googlePlace.rating || 0,
        totalReviews: googlePlace.user_ratings_total || 0,
        totalPhotos: googlePlace.photos?.length || 0,
        totalLikes: 0,
      },
    };
  }

  /**
   * Affiner la catégorie basée sur le nom du lieu
   */
  private refineCategoryByName(name: string, defaultCategory: string, types: string[]): string {
    const nameLower = name.toLowerCase();
    
    // Mots-clés pour les montagnes
    const mountainKeywords = ['pic ', 'mont ', 'sommet', 'col ', 'crête', 'peak', 'mountain', 'hill'];
    const mountainExclusions = ['montcalm', 'montpellier', 'montreal', 'montgomery']; // Noms de villes/quartiers à exclure
    
    if (mountainKeywords.some(keyword => nameLower.includes(keyword))) {
      // Vérifier que ce n'est pas un nom de ville ou de quartier
      if (!mountainExclusions.some(exclusion => nameLower.includes(exclusion))) {
        this.logger.debug(`Categorizing "${name}" as mountain based on name`);
        return 'mountain';
      }
    }
    
    // Mots-clés pour les parcs, jardins et paysages
    const landscapeKeywords = ['parc', 'park', 'jardin', 'garden', 'jardins', 'gardens', 'square', 
                              'esplanade', 'promenade', 'botanical', 'botanique', 'plantes', 'plants'];
    if (landscapeKeywords.some(keyword => nameLower.includes(keyword))) {
      this.logger.debug(`Categorizing "${name}" as landscape based on name`);
      return 'landscape';
    }
    
    // Mots-clés pour les points de vue et paysages
    const viewpointKeywords = ['viewpoint', 'vue', 'belvédère', 'panorama', 'vista', 'lookout', 'mirador', 'view'];
    if (viewpointKeywords.some(keyword => nameLower.includes(keyword))) {
      this.logger.debug(`Categorizing "${name}" as landscape based on name`);
      return 'landscape';
    }
    
    // Mots-clés pour les cascades et lieux d'eau
    const waterfallKeywords = ['cascade', 'chute', 'fall', 'lac', 'lake', 'rivière', 'river', 'source', 'cirque'];
    if (waterfallKeywords.some(keyword => nameLower.includes(keyword))) {
      this.logger.debug(`Categorizing "${name}" as waterfall based on name`);
      return 'waterfall';
    }
    
    // Mots-clés pour les plages
    const beachKeywords = ['plage', 'beach', 'mer', 'sea', 'océan', 'ocean', 'côte', 'coast'];
    if (beachKeywords.some(keyword => nameLower.includes(keyword))) {
      return 'beach';
    }
    
    // Mots-clés pour les forêts
    const forestKeywords = ['forêt', 'forest', 'bois', 'wood', 'arbre', 'tree'];
    if (forestKeywords.some(keyword => nameLower.includes(keyword))) {
      return 'forest';
    }
    
    // Mots-clés pour les lieux religieux
    const religiousKeywords = ['église', 'church', 'cathédrale', 'cathedral', 'abbaye', 'abbey', 
                               'chapelle', 'chapel', 'mosquée', 'mosque', 'temple', 'synagogue'];
    if (religiousKeywords.some(keyword => nameLower.includes(keyword))) {
      return 'religious';
    }
    
    // Mots-clés pour les lieux historiques
    const historicalKeywords = ['château', 'castle', 'fort', 'musée', 'museum', 'monument', 
                                'historic', 'historique', 'ancient', 'vieux', 'old'];
    if (historicalKeywords.some(keyword => nameLower.includes(keyword))) {
      return 'historical';
    }
    
    // Si c'est un établissement et qu'on n'a pas trouvé mieux, vérifier si c'est naturel
    if (types.includes('establishment') || types.includes('point_of_interest') || types.includes('tourist_attraction')) {
      // Si le lieu contient des mots liés à la nature, le classer en paysage
      const natureKeywords = ['nature', 'natural', 
                              'réserve', 'reserve', 'site', 'gorge', 'canyon'];
      if (natureKeywords.some(keyword => nameLower.includes(keyword))) {
        this.logger.debug(`Categorizing "${name}" as landscape based on nature keywords`);
        return 'landscape';
      }
    }
    
    this.logger.debug(`Keeping default category "${defaultCategory}" for "${name}" (types: ${types.join(', ')})`);
    
    // Sinon, retourner la catégorie par défaut
    return defaultCategory;
  }

  /**
   * Obtenir des suggestions d'autocomplétion pour les lieux
   */
  async getAutocomplete(
    params: AutocompleteQueryDto,
  ): Promise<AutocompleteResponseDto> {
    if (!this.apiKey) {
      this.logger.warn(
        'Google Places API key not configured, returning empty predictions',
      );
      return {
        predictions: [],
        status: 'API_KEY_MISSING',
      };
    }

    try {
      const { input, latitude, longitude, radius } = params;

      // Utiliser l'ancienne API Places Autocomplete qui est plus stable
      const baseUrl = `${this.baseUrl}/autocomplete/json`;
      
      const queryParams = new URLSearchParams({
        input: input,
        key: this.apiKey,
        language: 'fr',
        types: 'geocode|establishment', // Villes, régions et établissements
      });

      // Ajouter le biais de localisation si fourni
      if (latitude && longitude) {
        queryParams.append('location', `${latitude},${longitude}`);
        if (radius) {
          const safeRadius = Math.max(1, Math.min(radius || 5000, 50000));
          queryParams.append('radius', safeRadius.toString());
        } else {
          queryParams.append('radius', '50000'); // 50km par défaut
        }
      }

      const url = `${baseUrl}?${queryParams.toString()}`;
      
      this.logger.debug(`Making Places Autocomplete request to: ${url}`);

      const response = await fetch(url);
      const data = await response.json();
      
      this.logger.debug(`Response status: ${data.status}`);
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        this.logger.error(
          `Google Places Autocomplete API error: ${data.status} - ${data.error_message || ''}`,
        );
        return {
          predictions: [],
          status: data.status,
        };
      }

      // Convertir les résultats au format attendu
      const predictions: AutocompletePrediction[] = (data.predictions || [])
        .map((prediction: any) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting?.main_text || prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text || '',
          types: prediction.types || [],
          distanceMeters: prediction.distance_meters,
        }))
        // Filtrer pour garder seulement les lieux pertinents
        .filter((pred: AutocompletePrediction) => {
          // Garder les villes, régions, pays et points d'intérêt
          const relevantTypes = [
            'locality',
            'sublocality',
            'administrative_area_level_1',
            'administrative_area_level_2',
            'country',
            'point_of_interest',
            'establishment',
            'natural_feature',
            'park',
            'tourist_attraction',
            'route', // Pour les rues
            'geocode',
          ];
          
          return pred.types.some(type => relevantTypes.includes(type));
        });

      return {
        predictions,
        status: 'OK',
      };
    } catch (error) {
      this.logger.error('Error during autocomplete request:', error);
      return {
        predictions: [],
        status: 'ERROR',
      };
    }
  }

  /**
   * Mapper les types Google Places vers nos catégories
   */
  private mapGoogleTypesToOurCategories(googleTypes: string[]): string[] {
    const categoryMapping: Record<string, string> = {
      // Nature et montagnes (priorité très haute)
      'mountain': 'mountain',
      'hill': 'mountain',
      'peak': 'mountain',
      'natural_feature': 'landscape',
      'hiking_area': 'mountain',
      'scenic_point': 'landscape',
      'viewpoint': 'landscape',
      
      // Forêts et parcs
      'forest': 'forest',
      'national_park': 'forest',
      'park': 'landscape',
      'botanical_garden': 'landscape',
      'garden': 'landscape',
      'campground': 'forest',
      
      // Eau
      'waterfall': 'waterfall',
      'lake': 'waterfall',
      'river': 'waterfall',
      'beach': 'beach',
      'marina': 'beach',
      
      // Architecture et bâtiments
      'train_station': 'architecture',
      'transit_station': 'architecture',
      'bus_station': 'architecture',
      'subway_station': 'architecture',
      'premise': 'architecture',
      'city_hall': 'architecture',
      'courthouse': 'architecture',
      'embassy': 'architecture',
      'library': 'architecture',
      'university': 'architecture',
      'school': 'architecture',
      
      // Religieux
      'church': 'religious',
      'mosque': 'religious',
      'synagogue': 'religious',
      'hindu_temple': 'religious',
      'place_of_worship': 'religious',
      'cemetery': 'religious',

      // Historique
      'museum': 'historical',
      'art_gallery': 'historical',
      'historical_landmark': 'historical',
      'historical_place': 'historical',
      'landmark': 'historical',

      // Urbain
      'shopping_mall': 'urban',
      'neighborhood': 'urban',
      'sublocality': 'urban',
      'locality': 'urban',
      'route': 'urban',
      'street_address': 'urban',
      'plaza': 'urban',
      'square': 'urban',
      
      // Types génériques (faible priorité)
      'tourist_attraction': 'landscape',
      'point_of_interest': 'landscape',
      'establishment': 'architecture',
      'zoo': 'landscape',
      'aquarium': 'landscape',
    };

    // Ordre de priorité pour la sélection de catégorie
    const priorityOrder = [
      'mountain',      // Priorité max pour les montagnes
      'forest',        // Puis les forêts
      'waterfall',     // Les cascades et lacs
      'beach',         // Les plages
      'religious',
      'historical',
      'architecture',
      'landscape',     // Paysage général
      'urban',
      'other'
    ];

    const foundCategories = new Set<string>();

    // Collecter toutes les catégories trouvées
    for (const googleType of googleTypes) {
      if (categoryMapping[googleType]) {
        foundCategories.add(categoryMapping[googleType]);
      }
    }

    // Retourner les catégories triées par priorité
    const mappedCategories = priorityOrder.filter(cat => foundCategories.has(cat));

    return mappedCategories.length > 0 ? mappedCategories : ['landscape'];
  }
}
