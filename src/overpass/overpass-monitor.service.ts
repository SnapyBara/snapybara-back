import { Injectable, Logger } from '@nestjs/common';

export interface QueryMetrics {
  total: number;
  success: number;
  failed: number;
  rateLimited: number;
  timeouts: number;
  avgResponseTime: number;
  lastError?: string;
  lastErrorTime?: Date;
}

export interface ServerMetrics {
  [serverUrl: string]: QueryMetrics;
}

@Injectable()
export class OverpassMonitorService {
  private readonly logger = new Logger(OverpassMonitorService.name);
  private serverMetrics: ServerMetrics = {};
  private globalMetrics: QueryMetrics = {
    total: 0,
    success: 0,
    failed: 0,
    rateLimited: 0,
    timeouts: 0,
    avgResponseTime: 0,
  };

  /**
   * Enregistrer le début d'une requête
   */
  recordQueryStart(serverUrl: string): number {
    if (!this.serverMetrics[serverUrl]) {
      this.serverMetrics[serverUrl] = {
        total: 0,
        success: 0,
        failed: 0,
        rateLimited: 0,
        timeouts: 0,
        avgResponseTime: 0,
      };
    }

    this.serverMetrics[serverUrl].total++;
    this.globalMetrics.total++;

    return Date.now();
  }

  /**
   * Enregistrer le succès d'une requête
   */
  recordQuerySuccess(
    serverUrl: string,
    startTime: number,
    poisCount: number,
  ): void {
    const duration = Date.now() - startTime;
    const metrics = this.serverMetrics[serverUrl];

    if (metrics) {
      metrics.success++;
      metrics.avgResponseTime =
        (metrics.avgResponseTime * (metrics.success - 1) + duration) /
        metrics.success;
    }

    this.globalMetrics.success++;
    this.globalMetrics.avgResponseTime =
      (this.globalMetrics.avgResponseTime * (this.globalMetrics.success - 1) +
        duration) /
      this.globalMetrics.success;

    this.logger.debug(
      `Query success on ${serverUrl}: ${poisCount} POIs in ${duration}ms`,
    );
  }

  /**
   * Enregistrer l'échec d'une requête
   */
  recordQueryFailure(
    serverUrl: string,
    error: any,
    startTime: number,
    isRateLimit: boolean = false,
    isTimeout: boolean = false,
  ): void {
    const duration = Date.now() - startTime;
    const metrics = this.serverMetrics[serverUrl];

    if (metrics) {
      metrics.failed++;
      if (isRateLimit) metrics.rateLimited++;
      if (isTimeout) metrics.timeouts++;
      metrics.lastError = error.message || 'Unknown error';
      metrics.lastErrorTime = new Date();
    }

    this.globalMetrics.failed++;
    if (isRateLimit) this.globalMetrics.rateLimited++;
    if (isTimeout) this.globalMetrics.timeouts++;
    this.globalMetrics.lastError = error.message || 'Unknown error';
    this.globalMetrics.lastErrorTime = new Date();

    this.logger.warn(
      `Query failed on ${serverUrl} after ${duration}ms: ${error.message}`,
    );
  }

  /**
   * Obtenir les métriques pour un serveur
   */
  getServerMetrics(serverUrl: string): QueryMetrics | undefined {
    return this.serverMetrics[serverUrl];
  }

  /**
   * Obtenir toutes les métriques
   */
  getAllMetrics(): {
    global: QueryMetrics;
    servers: ServerMetrics;
  } {
    return {
      global: this.globalMetrics,
      servers: this.serverMetrics,
    };
  }

  /**
   * Obtenir le meilleur serveur basé sur les métriques
   */
  getBestServer(servers: string[]): string {
    let bestServer = servers[0];
    let bestScore = -1;

    for (const server of servers) {
      const metrics = this.serverMetrics[server];
      if (!metrics || metrics.total === 0) {
        // Nouveau serveur ou pas de données - lui donner une chance
        return server;
      }

      // Calculer un score basé sur le taux de succès et le temps de réponse
      const successRate = metrics.success / metrics.total;
      const avgTime = metrics.avgResponseTime || 1000;
      const recentError =
        metrics.lastErrorTime &&
        Date.now() - metrics.lastErrorTime.getTime() < 300000; // 5 minutes

      // Score = taux de succès * 1000 - temps moyen - pénalité pour erreur récente
      const score = successRate * 1000 - avgTime / 10 - (recentError ? 200 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestServer = server;
      }
    }

    return bestServer;
  }

  /**
   * Logger un rapport périodique
   */
  logReport(): void {
    const metrics = this.getAllMetrics();

    this.logger.log('=== Overpass API Metrics Report ===');
    this.logger.log(`Global: ${JSON.stringify(metrics.global, null, 2)}`);

    for (const [server, serverMetrics] of Object.entries(metrics.servers)) {
      const successRate =
        serverMetrics.total > 0
          ? ((serverMetrics.success / serverMetrics.total) * 100).toFixed(1)
          : '0';

      this.logger.log(
        `${server}: Success rate: ${successRate}%, ` +
          `Avg time: ${serverMetrics.avgResponseTime.toFixed(0)}ms, ` +
          `Rate limits: ${serverMetrics.rateLimited}, ` +
          `Timeouts: ${serverMetrics.timeouts}`,
      );
    }
  }

  /**
   * Réinitialiser les métriques
   */
  resetMetrics(): void {
    this.serverMetrics = {};
    this.globalMetrics = {
      total: 0,
      success: 0,
      failed: 0,
      rateLimited: 0,
      timeouts: 0,
      avgResponseTime: 0,
    };
    this.logger.log('Metrics reset');
  }
}
