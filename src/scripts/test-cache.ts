import * as dotenv from 'dotenv';
import { GooglePlacesService } from '../google-places/google-places.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { createClient } from 'redis';

// Charger les variables d'environnement
dotenv.config();

async function testCache() {
  console.log('🔍 Testing Redis Cache...\n');

  // Créer le client Redis directement
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    password: process.env.REDIS_PASSWORD,
  });

  await redisClient.connect();

  // Créer un mock minimaliste du cache manager avec seulement les méthodes utilisées
  const cacheManager = {
    get: async (key: string) => {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value as string) : null;
    },
    set: async (key: string, value: any, ttl?: number) => {
      await redisClient.setEx(key, ttl || 3600, JSON.stringify(value));
    },
    del: async (key: string) => {
      await redisClient.del(key);
    },
  } as unknown as Cache;

  const configService = {
    get: (key: string, defaultValue?: any) => process.env[key] || defaultValue,
  } as ConfigService;

  const cacheService = new CacheService(cacheManager);

  const googlePlacesService = new GooglePlacesService(
    configService,
    cacheService,
  );

  const start1 = Date.now();
  const result1 = await googlePlacesService.nearbySearch({
    latitude: 43.6108,
    longitude: 3.8767,
    radius: 5000,
  });
  const time1 = Date.now() - start1;
  console.log(
    `✅ ${result1.length} lieux trouvés en ${time1}ms (première requête)`,
  );

  const start2 = Date.now();
  const result2 = await googlePlacesService.nearbySearch({
    latitude: 43.6108,
    longitude: 3.8767,
    radius: 5000,
  });
  const time2 = Date.now() - start2;
  console.log(
    `✅ ${result2.length} lieux trouvés en ${time2}ms (depuis le cache)`,
  );
  console.log(
    `⚡ Amélioration de performance: ${Math.round(((time1 - time2) / time1) * 100)}%\n`,
  );

  const start3 = Date.now();
  const auto1 = await googlePlacesService.getAutocomplete({
    input: 'Mont',
    latitude: 43.6108,
    longitude: 3.8767,
  });
  const time3 = Date.now() - start3;
  console.log(`\n📍 Autocomplétion:`);
  console.log(
    `✅ ${auto1.predictions.length} suggestions trouvées en ${time3}ms (première requête)`,
  );

  const start4 = Date.now();
  const auto2 = await googlePlacesService.getAutocomplete({
    input: 'Mont',
    latitude: 43.6108,
    longitude: 3.8767,
  });
  const time4 = Date.now() - start4;
  console.log(
    `✅ ${auto2.predictions.length} suggestions trouvées en ${time4}ms (depuis le cache)`,
  );
  console.log(
    `⚡ Amélioration de performance: ${Math.round(((time3 - time4) / time3) * 100)}%\n`,
  );

  // Afficher les statistiques
  const stats = await cacheService.getStats();
  console.log('📊 Statistiques du cache:', stats);

  await redisClient.quit();
  console.log('\n✅ Tests terminés');
}

testCache().catch((error) => {
  console.error('❌ Erreur lors des tests:', error);
  process.exit(1);
});
