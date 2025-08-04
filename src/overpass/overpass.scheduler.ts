import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OverpassService } from './overpass.service';

@Injectable()
export class OverpassScheduler {
  private readonly logger = new Logger(OverpassScheduler.name);

  constructor(private readonly overpassService: OverpassService) {}

  /**
   * Réchauffer le cache toutes les 6 heures
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCacheWarming() {
    this.logger.log('Starting scheduled cache warming...');
    
    try {
      await this.overpassService.warmCache();
      this.logger.log('Scheduled cache warming completed');
    } catch (error) {
      this.logger.error('Scheduled cache warming failed:', error);
    }
  }

  /**
   * Précharger les zones populaires tous les jours à 3h du matin
   */
  @Cron('0 3 * * *')
  async handleDailyPreload() {
    this.logger.log('Starting daily popular areas preload...');
    
    try {
      await this.overpassService.preloadPopularAreas();
      this.logger.log('Daily preload completed');
    } catch (error) {
      this.logger.error('Daily preload failed:', error);
    }
  }

  /**
   * Nettoyer le cache expiré tous les jours à 5h du matin
   */
  @Cron('0 5 * * *')
  async handleCacheCleanup() {
    this.logger.log('Starting cache cleanup...');
    
    try {
      // Note: Cette fonctionnalité dépend de votre implémentation Redis
      // Redis gère automatiquement l'expiration avec TTL
      this.logger.log('Cache cleanup completed (handled by Redis TTL)');
    } catch (error) {
      this.logger.error('Cache cleanup failed:', error);
    }
  }
}
