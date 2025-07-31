import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PointsService } from '../points/points.service';
import { GooglePlacesService } from '../google-places/google-places.service';
import { POICategory } from '../points/dto/create-point.dto';

async function testSearch() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const pointsService = app.get(PointsService);
    const googlePlacesService = app.get(GooglePlacesService);

    // Coordonnées de Montpellier
    const montpellierLat = 43.6108;
    const montpellierLng = 3.8767;

    console.log('🔍 Test de recherche autour de Montpellier...\n');

    // Test 1: Recherche MongoDB native
    console.log('1️⃣ Recherche MongoDB (rayon 50km):');
    const mongoResults = await pointsService['pointModel'].aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [montpellierLng, montpellierLat],
          },
          distanceField: 'distance',
          maxDistance: 50000, // 50km en mètres
          spherical: true,
          query: { isActive: true, status: 'approved' },
        },
      },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          category: 1,
          distance: 1,
          'metadata.googleTypes': 1,
        },
      },
    ]);

    console.log(`Trouvé ${mongoResults.length} points:`);
    mongoResults.forEach((point) => {
      console.log(
        `  - ${point.name} (${point.category}) - ${Math.round(point.distance / 1000)}km`,
      );
    });

    // Test 2: Recherche Google Places
    console.log('\n2️⃣ Recherche Google Places:');
    const googleResults = await googlePlacesService.nearbySearch({
      latitude: montpellierLat,
      longitude: montpellierLng,
      radius: 20000, // 20km
    });

    console.log(`Trouvé ${googleResults.length} lieux Google Places:`);
    googleResults.slice(0, 10).forEach((place) => {
      console.log(
        `  - ${place.name} - Types: ${place.types.slice(0, 3).join(', ')}`,
      );
    });

    // Test 3: Recherche spécifique "Pic Saint-Loup"
    console.log('\n3️⃣ Recherche spécifique "Pic Saint-Loup":');
    const picResults = await googlePlacesService.textSearch({
      query: 'Pic Saint-Loup',
      latitude: montpellierLat,
      longitude: montpellierLng,
      radius: 50000,
    });

    if (picResults.length > 0) {
      console.log(`✅ Trouvé ${picResults.length} résultat(s):`);
      picResults.forEach((place) => {
        console.log(`  - ${place.name}`);
        console.log(`    Adresse: ${place.formatted_address}`);
        console.log(`    Types: ${place.types.join(', ')}`);
        console.log(
          `    Coords: ${place.geometry.location.lat}, ${place.geometry.location.lng}`,
        );
      });
    } else {
      console.log('❌ Aucun résultat trouvé');
    }

    // Test 4: Recherche hybride via le service
    console.log('\n4️⃣ Test recherche hybride (via PointsService):');
    const hybridResults = await pointsService.searchHybrid({
      latitude: montpellierLat,
      longitude: montpellierLng,
      radius: 30,
      categories: ['mountain', 'landscape'] as any, // Les catégories sont converties en minuscules dans l'API
      page: 1,
      limit: 20,
    });

    console.log(`\nRésultats hybrides:`);
    console.log(`- Total: ${hybridResults.total}`);
    console.log(`- MongoDB: ${hybridResults.sources.mongodb}`);
    console.log(`- Google Places: ${hybridResults.sources.googlePlaces}`);
    console.log(`\nPoints trouvés:`);
    hybridResults.data.forEach((point) => {
      console.log(`  - ${point.name} (${point.category})`);
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await app.close();
  }
}

// Exécuter le script
testSearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
