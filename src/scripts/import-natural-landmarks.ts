import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PointsService } from '../points/points.service';
import { GooglePlacesService } from '../google-places/google-places.service';

// Liste des landmarks naturels importants autour de Montpellier
const NATURAL_LANDMARKS = [
  {
    name: 'Pic Saint-Loup',
    latitude: 43.7808,
    longitude: 3.8094,
    searchTerms: ['Pic Saint-Loup', 'sommet montpellier'],
  },
  {
    name: 'Mont Aigoual',
    latitude: 44.1214,
    longitude: 3.5819,
    searchTerms: ['Mont Aigoual', 'sommet cévennes'],
  },
  {
    name: 'Cirque de Navacelles',
    latitude: 43.8903,
    longitude: 3.5031,
    searchTerms: ['Cirque de Navacelles'],
  },
  {
    name: 'Lac du Salagou',
    latitude: 43.6533,
    longitude: 3.3711,
    searchTerms: ['Lac du Salagou'],
  },
  {
    name: "Gorges de l'Hérault",
    latitude: 43.7333,
    longitude: 3.55,
    searchTerms: ['Gorges Hérault', 'Pont du Diable'],
  },
  {
    name: 'Grotte des Demoiselles',
    latitude: 43.8969,
    longitude: 3.8603,
    searchTerms: ['Grotte des Demoiselles'],
  },
  {
    name: 'Camargue',
    latitude: 43.5283,
    longitude: 4.4289,
    searchTerms: ['Parc naturel Camargue', 'Saintes-Maries-de-la-Mer'],
  },
];

async function importNaturalLandmarks() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const pointsService = app.get(PointsService);
    const googlePlacesService = app.get(GooglePlacesService);

    console.log('🏔️ Import des landmarks naturels...');

    for (const landmark of NATURAL_LANDMARKS) {
      console.log(`\n📍 Recherche de ${landmark.name}...`);

      // Chercher le lieu via Google Places
      let found = false;

      for (const searchTerm of landmark.searchTerms) {
        if (found) break;

        const results = await googlePlacesService.textSearch({
          query: searchTerm,
          latitude: landmark.latitude,
          longitude: landmark.longitude,
          radius: 10000, // 10km de rayon
        });

        if (results.length > 0) {
          console.log(
            `✅ Trouvé ${results.length} résultat(s) pour "${searchTerm}"`,
          );

          // Prendre le premier résultat le plus proche
          const bestMatch = results[0];

          // Vérifier si ce lieu existe déjà dans MongoDB
          const existing = await pointsService['pointModel'].findOne({
            'metadata.googlePlaceId': bestMatch.place_id,
          });

          if (existing) {
            console.log(`⏭️ ${bestMatch.name} existe déjà dans la base`);
          } else {
            // Créer le point
            const pointData =
              googlePlacesService.convertToPointOfInterest(bestMatch);

            // Forcer la catégorie appropriée
            if (
              landmark.name.includes('Pic') ||
              landmark.name.includes('Mont')
            ) {
              pointData.category = 'mountain';
            } else if (landmark.name.includes('Lac')) {
              pointData.category = 'waterfall'; // Catégorie eau
            } else if (
              landmark.name.includes('Gorges') ||
              landmark.name.includes('Cirque')
            ) {
              pointData.category = 'landscape';
            } else if (landmark.name.includes('Grotte')) {
              pointData.category = 'landscape';
            } else if (landmark.name.includes('Camargue')) {
              pointData.category = 'landscape';
            }

            const newPoint = await pointsService['pointModel'].create({
              ...pointData,
              location: {
                type: 'Point',
                coordinates: [pointData.longitude, pointData.latitude],
              },
              userId: null,
              status: 'approved',
              isPublic: true,
              metadata: {
                ...pointData.metadata,
                importedFromGooglePlaces: true,
                importedAt: new Date(),
                naturalLandmark: true,
              },
            });

            console.log(`✨ Créé: ${newPoint.name} (${newPoint.category})`);
          }

          found = true;
        }
      }

      if (!found) {
        console.log(`❌ Aucun résultat trouvé pour ${landmark.name}`);
      }
    }

    console.log('\n✅ Import terminé!');
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await app.close();
  }
}

// Exécuter le script
importNaturalLandmarks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
