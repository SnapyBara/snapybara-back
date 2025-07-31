import * as dotenv from 'dotenv';
import { GooglePlacesService } from '../google-places/google-places.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Mock du CacheService pour les tests
class MockCacheService {
  async get<T>(key: string): Promise<T | undefined> {
    return undefined;
  }

  async set(key: string, value: any, options?: any): Promise<void> {
    // Ne rien faire
  }

  async del(key: string): Promise<void> {
    // Ne rien faire
  }

  async reset(): Promise<void> {
    // Ne rien faire
  }

  generateGooglePlacesSearchKey(params: any): string {
    return `test:${JSON.stringify(params)}`;
  }

  generateGooglePlacesTextSearchKey(params: any): string {
    return `test:text:${JSON.stringify(params)}`;
  }

  generateAutocompleteKey(params: any): string {
    return `test:auto:${JSON.stringify(params)}`;
  }

  generatePlaceDetailsKey(placeId: string): string {
    return `test:details:${placeId}`;
  }

  generatePhotoKey(photoReference: string, maxWidth: number): string {
    return `test:photo:${photoReference}:${maxWidth}`;
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: any,
  ): Promise<T> {
    return factory();
  }

  async getStats() {
    return { hits: 0, misses: 0, hitRate: 0 };
  }

  private DEFAULT_TTL = {
    SEARCH: 3600,
    DETAILS: 86400,
    PHOTOS: 604800,
    AUTOCOMPLETE: 1800,
  };
}

// Charger les variables d'environnement
dotenv.config();

async function testAutocomplete() {
  // Mock du ConfigService
  const configService = {
    get: (key: string) => process.env[key],
  } as ConfigService;

  const mockCacheService = new MockCacheService() as any;
  const googlePlacesService = new GooglePlacesService(configService, mockCacheService);

  console.log('🔍 Testing Google Places Autocomplete...\n');

  // Test 1: Recherche simple
  console.log('Test 1: Recherche "Paris"');
  const result1 = await googlePlacesService.getAutocomplete({
    input: 'Paris',
  });
  console.log(`Status: ${result1.status}`);
  console.log(`Nombre de résultats: ${result1.predictions.length}`);
  result1.predictions.slice(0, 3).forEach((pred, index) => {
    console.log(`  ${index + 1}. ${pred.mainText} - ${pred.secondaryText}`);
    console.log(`     Types: ${pred.types.join(', ')}`);
  });

  console.log('\n---\n');

  // Test 2: Recherche avec localisation
  console.log('Test 2: Recherche "Mont" près de Montpellier');
  const result2 = await googlePlacesService.getAutocomplete({
    input: 'Mont',
    latitude: 43.6108,
    longitude: 3.8767,
    radius: 50000,
  });
  console.log(`Status: ${result2.status}`);
  console.log(`Nombre de résultats: ${result2.predictions.length}`);
  result2.predictions.slice(0, 5).forEach((pred, index) => {
    console.log(`  ${index + 1}. ${pred.mainText} - ${pred.secondaryText}`);
    if (pred.distanceMeters) {
      console.log(`     Distance: ${pred.distanceMeters}m`);
    }
  });

  console.log('\n✅ Tests terminés');
}

// Exécuter les tests
testAutocomplete().catch((error) => {
  console.error('❌ Erreur lors des tests:', error);
  process.exit(1);
});