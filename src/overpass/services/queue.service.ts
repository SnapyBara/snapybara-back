import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Tile } from './tile.service';

export enum QueryPriority {
  CRITICAL = 0, // User is waiting
  HIGH = 1, // Prefetch for likely next request
  NORMAL = 2, // Regular background update
  LOW = 3, // Precomputation
}

export interface OverpassQuery {
  id: string;
  type: 'tile' | 'area' | 'custom';
  query?: string;
  tile?: Tile;
  area?: { lat: number; lon: number; radius: number };
  priority: QueryPriority;
  retries: number;
  createdAt: Date;
  callback?: (result: any) => void;
}

export interface QueueMetrics {
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  avgProcessingTime: number;
  queueLength: number;
  processingRate: number; // queries per minute
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<QueryPriority, OverpassQuery[]> = new Map();
  private processing = false;
  private metrics: QueueMetrics = {
    totalQueries: 0,
    completedQueries: 0,
    failedQueries: 0,
    avgProcessingTime: 0,
    queueLength: 0,
    processingRate: 0,
  };

  // Rate limiting configuration - IMPROVED
  private readonly MIN_DELAY_MS = 2000; // Minimum 2s between queries (was 1s)
  private readonly MAX_DELAY_MS = 30000; // Maximum 30s between queries (was 10s)
  private readonly MAX_CONCURRENT_QUERIES = 3; // Limit concurrent queries
  private readonly MAX_QUEUE_SIZE = 50; // Maximum queue size (was unlimited)
  private currentDelay = this.MIN_DELAY_MS;
  private lastQueryTime = 0;
  private consecutiveFailures = 0;
  private activeQueries = 0;

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Initialize queues
    for (const priority of Object.values(QueryPriority)) {
      if (typeof priority === 'number') {
        this.queues.set(priority, []);
      }
    }
  }

  /**
   * Add a query to the queue - WITH SIZE LIMIT
   */
  async enqueue(query: OverpassQuery): Promise<void> {
    // Check total queue size
    if (this.metrics.queueLength >= this.MAX_QUEUE_SIZE) {
      this.logger.warn(
        `Queue full (${this.metrics.queueLength}/${this.MAX_QUEUE_SIZE}), dropping query ${query.id}`,
      );
      return;
    }

    // Check if similar query already exists
    if (this.isDuplicateQuery(query)) {
      this.logger.debug(`Skipping duplicate query: ${query.id}`);
      return;
    }

    const queue = this.queues.get(query.priority) || [];
    queue.push(query);
    this.queues.set(query.priority, queue);

    this.metrics.totalQueries++;
    this.updateQueueLength();

    this.logger.log(
      `Enqueued query ${query.id} with priority ${QueryPriority[query.priority]}`,
    );

    // Start processing if not already running
    if (!this.processing && this.activeQueries < this.MAX_CONCURRENT_QUERIES) {
      this.startProcessing();
    }
  }

  /**
   * Check if a similar query is already in queue
   */
  private isDuplicateQuery(newQuery: OverpassQuery): boolean {
    for (const [_, queue] of this.queues) {
      for (const query of queue) {
        if (query.type === newQuery.type) {
          if (query.type === 'tile' && newQuery.type === 'tile') {
            if (
              query.tile?.x === newQuery.tile?.x &&
              query.tile?.y === newQuery.tile?.y &&
              query.tile?.zoom === newQuery.tile?.zoom
            ) {
              return true;
            }
          } else if (query.type === 'area' && newQuery.type === 'area') {
            if (
              query.area?.lat === newQuery.area?.lat &&
              query.area?.lon === newQuery.area?.lon &&
              query.area?.radius === newQuery.area?.radius
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Get next query from queue
   */
  private getNextQuery(): OverpassQuery | null {
    // Check queues in priority order
    for (const priority of [
      QueryPriority.CRITICAL,
      QueryPriority.HIGH,
      QueryPriority.NORMAL,
      QueryPriority.LOW,
    ]) {
      const queue = this.queues.get(priority) || [];
      if (queue.length > 0) {
        const query = queue.shift();
        this.queues.set(priority, queue);
        this.updateQueueLength();
        return query || null;
      }
    }
    return null;
  }

  /**
   * Start processing queries
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    this.logger.log('Started queue processing');

    while (true) {
      const query = this.getNextQuery();
      if (!query) {
        this.processing = false;
        this.logger.log('Queue processing stopped - no more queries');
        break;
      }

      await this.processQuery(query);
      await this.respectRateLimit();
    }
  }

  /**
   * Process a single query - WITH CONCURRENT LIMIT
   */
  private async processQuery(query: OverpassQuery): Promise<void> {
    const startTime = Date.now();
    this.activeQueries++;

    try {
      this.logger.debug(
        `Processing query ${query.id} (active: ${this.activeQueries}/${this.MAX_CONCURRENT_QUERIES})`,
      );

      // Emit event for the actual processing
      await this.eventEmitter.emitAsync('overpass.query.execute', query);

      // Success
      this.consecutiveFailures = 0;
      this.currentDelay = Math.max(this.MIN_DELAY_MS, this.currentDelay * 0.9); // Gradually reduce delay

      this.metrics.completedQueries++;
      this.updateProcessingTime(Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Query ${query.id} failed:`, error.message);

      this.consecutiveFailures++;
      this.metrics.failedQueries++;

      // Exponential backoff with higher multiplier
      this.currentDelay = Math.min(
        this.MAX_DELAY_MS,
        this.currentDelay * Math.pow(2, this.consecutiveFailures), // Changed from 1.5 to 2
      );

      // Retry logic - reduced retries
      if (query.retries < 2) {
        // Reduced from 3 to 2
        query.retries++;
        query.priority = Math.min(
          query.priority + 1,
          QueryPriority.LOW,
        ) as QueryPriority;
        await this.enqueue(query);
        this.logger.log(
          `Requeued query ${query.id} (attempt ${query.retries + 1})`,
        );
      } else {
        this.logger.error(
          `Query ${query.id} failed after ${query.retries} attempts`,
        );
        if (query.callback) {
          query.callback({ error: error.message });
        }
      }
    } finally {
      this.activeQueries--;
    }
  }

  /**
   * Respect rate limiting
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastQuery = now - this.lastQueryTime;

    if (timeSinceLastQuery < this.currentDelay) {
      const waitTime = this.currentDelay - timeSinceLastQuery;
      this.logger.debug(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastQueryTime = Date.now();
  }

  /**
   * Update queue length metric
   */
  private updateQueueLength(): void {
    let total = 0;
    for (const [_, queue] of this.queues) {
      total += queue.length;
    }
    this.metrics.queueLength = total;
  }

  /**
   * Update average processing time
   */
  private updateProcessingTime(duration: number): void {
    const total = this.metrics.completedQueries + this.metrics.failedQueries;
    if (total === 0) {
      this.metrics.avgProcessingTime = duration;
    } else {
      this.metrics.avgProcessingTime =
        (this.metrics.avgProcessingTime * (total - 1) + duration) / total;
    }

    // Update processing rate (queries per minute)
    const timePeriod = 60000; // 1 minute
    const recentQueries = this.metrics.completedQueries; // Simplified for now
    this.metrics.processingRate = (recentQueries / timePeriod) * 60000;
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { priority: string; length: number }[] {
    const status: { priority: string; length: number }[] = [];
    for (const [priority, queue] of this.queues) {
      status.push({
        priority: QueryPriority[priority],
        length: queue.length,
      });
    }
    return status;
  }

  /**
   * Clear all queues
   */
  clearQueues(): void {
    for (const [priority, _] of this.queues) {
      this.queues.set(priority, []);
    }
    this.updateQueueLength();
    this.logger.log('All queues cleared');
  }

  /**
   * Adjust rate limiting based on metrics
   */
  adjustRateLimiting(): void {
    const failureRate =
      this.metrics.failedQueries /
      (this.metrics.completedQueries + this.metrics.failedQueries);

    if (failureRate > 0.3) {
      // High failure rate - increase delay
      this.currentDelay = Math.min(this.MAX_DELAY_MS, this.currentDelay * 1.5);
      this.logger.warn(
        `High failure rate (${(failureRate * 100).toFixed(1)}%), increasing delay to ${this.currentDelay}ms`,
      );
    } else if (failureRate < 0.05 && this.metrics.queueLength > 10) {
      // Low failure rate with backlog - decrease delay
      this.currentDelay = Math.max(this.MIN_DELAY_MS, this.currentDelay * 0.8);
      this.logger.log(
        `Low failure rate, decreasing delay to ${this.currentDelay}ms`,
      );
    }
  }

  /**
   * Prefetch tiles for anticipated user movement - DISABLED BY DEFAULT
   */
  async prefetchArea(
    lat: number,
    lon: number,
    radiusKm: number,
  ): Promise<void> {
    // DISABLED - Comment out to re-enable prefetching
    this.logger.debug('Prefetching disabled to reduce server load');
    return;

    /* ORIGINAL CODE - Uncomment to re-enable
    // Calculate movement predictions
    const directions = [
      { dlat: 0.01, dlon: 0 },      // North
      { dlat: -0.01, dlon: 0 },     // South
      { dlat: 0, dlon: 0.01 },      // East
      { dlat: 0, dlon: -0.01 },     // West
    ];
    
    for (const dir of directions) {
      const prefetchLat = lat + dir.dlat;
      const prefetchLon = lon + dir.dlon;
      
      const query: OverpassQuery = {
        id: `prefetch-${prefetchLat}-${prefetchLon}-${Date.now()}`,
        type: 'area',
        area: { lat: prefetchLat, lon: prefetchLon, radius: radiusKm },
        priority: QueryPriority.HIGH,
        retries: 0,
        createdAt: new Date(),
      };
      
      await this.enqueue(query);
    }
    */
  }
}
