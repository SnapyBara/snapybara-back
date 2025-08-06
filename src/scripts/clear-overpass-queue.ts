/**
 * Script to clear Overpass queue and stop automatic pre-loading
 * Run with: npm run script:clear-queue
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QueueService } from '../overpass/services/queue.service';
import { OptimizedSearchService } from '../overpass/services/optimized-search.service';
import { CacheService } from '../cache/cache.service';

async function clearOverpassQueue() {
  console.log('🚀 Starting Overpass queue clearing...');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Get services
    const queueService = app.get(QueueService);
    const optimizedSearchService = app.get(OptimizedSearchService);
    const cacheService = app.get(CacheService);

    // Get current status
    const beforeMetrics = queueService.getMetrics();
    console.log('\n📊 Current Status:');
    console.log(`- Queue length: ${beforeMetrics.queueLength}`);
    console.log(`- Total queries: ${beforeMetrics.totalQueries}`);
    console.log(`- Failed queries: ${beforeMetrics.failedQueries}`);
    console.log(
      `- Processing rate: ${beforeMetrics.processingRate.toFixed(2)} queries/min`,
    );

    // Clear queues
    console.log('\n🧹 Clearing all queues...');
    queueService.clearQueues();

    // Get updated status
    const afterMetrics = queueService.getMetrics();
    console.log('\n✅ Queues cleared!');
    console.log(`- Queue length: ${afterMetrics.queueLength}`);

    // Optional: Clear cache as well
    const clearCache = process.argv.includes('--clear-cache');
    if (clearCache) {
      console.log('\n🗑️  Clearing cache...');
      await optimizedSearchService.clearCache();
      console.log('✅ Cache cleared!');
    }

    // Show health status
    const health = await optimizedSearchService.getServiceHealth();
    console.log('\n🏥 Service Health:', health.status);

    console.log('\n✨ Done! The queue has been cleared.');
    console.log('\n💡 Tips to prevent queue buildup:');
    console.log('1. The pre-loading has been disabled in the code');
    console.log('2. Monitor the queue at: /admin/overpass/health');
    console.log('3. Adjust settings in: src/overpass/config/preload.config.ts');
    console.log('4. Use --clear-cache flag to also clear cached data');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await app.close();
  }
}

// Run the script
clearOverpassQueue()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
