/**
 * Script de test pour l'intégration Google Places API
 * Utilisation : npm run test:google-places
 */

import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GooglePlacesService } from './google-places.service';

async function testGooglePlaces() {
  console.log('🚀 Test Google Places API Integration');

  // Créer un mini module pour le test
  const app = await NestFactory.createApplicationContext(
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  );

  const configService = app.get(ConfigService);
  const googlePlacesService = new GooglePlacesService(configService);

  // Test 1: Vérifier la configuration
  console.log('\n📋 Test 1: Configuration');
  const apiKey = configService.get('GOOGLE_PLACES_API_KEY');
  if (apiKey) {
    console.log('✅ Google Places API Key configurée');
  } else {
    console.log('❌ Google Places API Key manquante');
    console.log(
      '💡 Ajoutez GOOGLE_PLACES_API_KEY=votre_cle à votre fichier .env',
    );
    return;
  }

  // Test 2: Recherche à proximité (Tour Eiffel)
  console.log('\n🗼 Test 2: Recherche à proximité de la Tour Eiffel');
  try {
    const nearbyResults = await googlePlacesService.nearbySearch({
      latitude: 48.8584,
      longitude: 2.2945,
      radius: 1000,
      keyword: 'monument',
    });

    console.log(`✅ Trouvé ${nearbyResults.length} lieux à proximité`);
    if (nearbyResults.length > 0) {
      console.log(`📍 Premier résultat: ${nearbyResults[0].name}`);
    }
  } catch (error) {
    console.log('❌ Erreur lors de la recherche à proximité:', error.message);
  }

  // Test 3: Recherche textuelle
  console.log('\n🔍 Test 3: Recherche textuelle "musée Paris"');
  try {
    const textResults = await googlePlacesService.textSearch({
      query: 'musée Paris',
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 10000,
    });

    console.log(`✅ Trouvé ${textResults.length} musées`);
    if (textResults.length > 0) {
      console.log(`🏛️ Premier résultat: ${textResults[0].name}`);
    }
  } catch (error) {
    console.log('❌ Erreur lors de la recherche textuelle:', error.message);
  }

  // Test 4: Détails d'un lieu (Tour Eiffel)
  console.log('\n📋 Test 4: Détails de la Tour Eiffel');
  try {
    const placeDetails = await googlePlacesService.getPlaceDetails(
      'ChIJLU7jZClu5kcR4PcOOO6p3I0',
    );

    if (placeDetails) {
      console.log('✅ Détails récupérés avec succès');
      console.log(`📍 Nom: ${placeDetails.name}`);
      console.log(`⭐ Note: ${placeDetails.rating || 'N/A'}/5`);
      console.log(`📸 Photos: ${placeDetails.photos?.length || 0}`);
    } else {
      console.log('❌ Aucun détail récupéré');
    }
  } catch (error) {
    console.log(
      '❌ Erreur lors de la récupération des détails:',
      error.message,
    );
  }

  // Test 5: Conversion vers notre format
  console.log('\n🔄 Test 5: Conversion vers notre format');
  try {
    const mockGooglePlace = {
      place_id: 'test_123',
      name: 'Test Monument',
      formatted_address: '123 Test Street, Paris, France',
      geometry: {
        location: {
          lat: 48.8566,
          lng: 2.3522,
        },
      },
      types: ['tourist_attraction', 'point_of_interest'],
      rating: 4.5,
      user_ratings_total: 1000,
    };

    const converted =
      googlePlacesService.convertToPointOfInterest(mockGooglePlace);
    console.log('✅ Conversion réussie');
    console.log(`📍 Nom: ${converted.name}`);
    console.log(`📂 Catégorie: ${converted.category}`);
    console.log(`⭐ Note: ${converted.statistics?.averageRating}`);
  } catch (error) {
    console.log('❌ Erreur lors de la conversion:', error.message);
  }

  console.log('\n🎉 Tests terminés !');
  console.log('\n💡 Pour utiliser les nouvelles fonctionnalités:');
  console.log(
    '   - GET /points/search/hybrid - Recherche hybride MongoDB + Google Places',
  );
  console.log(
    "   - GET /points/google-places/:placeId - Détails d'un lieu Google",
  );
  console.log('   - POST /points/import/google-places - Import en masse');

  await app.close();
}

// Exécuter les tests
if (require.main === module) {
  testGooglePlaces().catch(console.error);
}

export { testGooglePlaces };
