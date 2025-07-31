import * as dotenv from 'dotenv';
import { GooglePlacesService } from '../google-places/google-places.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { caching } from 'cache-manager';

// Charger les variables d'environnement
dotenv.config();

async function testCache() {
  console.log('🔍 Testing Redis Cache...\n');

  // Créer le cache manager
  const cacheManager = caching({
    store: redisStore as any,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    ttl: 3600,
  });

  // Mock du ConfigService
  const configService = {
    get: (key: string, defaultValue?: any) => process.env[key] || defaultValue,
  } as ConfigService;

  // Créer le service de cache
  const cacheService = new CacheService(cacheManager as any);

  // Créer le service Google Places avec cache
  const googlePlacesService = new GooglePlacesService(
    configService,
    cacheService,
  );

  console.log(
    '📍 Test 1: Recherche près de Montpellier (première fois - pas de cache)',
  );
  const start1 = Date.now();
  const result1 = await googlePlacesService.nearbySearch({
    latitude: 43.6108,
    longitude: 3.8767,
    radius: 5000,
  });
  const time1 = Date.now() - start1;
  console.log(`✅ ${result1.length} résultats trouvés en ${time1}ms\n`);

  console.log('📍 Test 2: Même recherche (deuxième fois - depuis le cache)');
  const start2 = Date.now();
  const result2 = await googlePlacesService.nearbySearch({
    latitude: 43.6108,
    longitude: 3.8767,
    radius: 5000,
  });
  const time2 = Date.now() - start2;
  console.log(`✅ ${result2.length} résultats trouvés en ${time2}ms`);
  console.log(
    `⚡ Amélioration de performance: ${Math.round(((time1 - time2) / time1) * 100)}%\n`,
  );

  console.log('🔍 Test 3: Autocomplétion "Mont" (première fois)');
  const start3 = Date.now();
  const auto1 = await googlePlacesService.getAutocomplete({
    input: 'Mont',
    latitude: 43.6108,
    longitude: 3.8767,
  });
  const time3 = Date.now() - start3;
  console.log(
    `✅ ${auto1.predictions.length} suggestions trouvées en ${time3}ms\n`,
  );

  console.log('🔍 Test 4: Même autocomplétion (depuis le cache)');
  const start4 = Date.now();
  const auto2 = await googlePlacesService.getAutocomplete({
    input: 'Mont',
    latitude: 43.6108,
    longitude: 3.8767,
  });
  const time4 = Date.now() - start4;
  console.log(
    `✅ ${auto2.predictions.length} suggestions trouvées en ${time4}ms`,
  );
  console.log(
    `⚡ Amélioration de performance: ${Math.round(((time3 - time4) / time3) * 100)}%\n`,
  );

  // Afficher les statistiques
  const stats = await cacheService.getStats();
  console.log('📊 Statistiques du cache:', stats);

  // Fermer la connexion Redis
  await (cacheManager as any).store.getClient().quit();
  console.log('\n✅ Tests terminés');
}

// Exécuter les tests
testCache().catch((error) => {
  console.error('❌ Erreur lors des tests:', error);
  process.exit(1);
});
