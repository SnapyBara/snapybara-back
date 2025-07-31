import * as dotenv from 'dotenv';
import { GooglePlacesService } from '../google-places/google-places.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Charger les variables d'environnement
dotenv.config();

async function testAutocomplete() {
  // Mock du ConfigService
  const configService = {
    get: (key: string) => process.env[key],
  } as ConfigService;

  const googlePlacesService = new GooglePlacesService(configService);

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