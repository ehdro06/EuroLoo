import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

type Client = ReturnType<typeof createClient>;

// Each Redis call gets this long before callers fall back to in-memory state
const COMMAND_TIMEOUT_MS = 500;
const ERROR_LOG_INTERVAL_MS = 60_000;

// Optional shared Redis (REDIS_URL). Without it, or while it's unreachable,
// `run` returns null and callers use their in-memory fallback, so a Redis
// outage degrades caching/rate limiting instead of breaking requests.
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Client | null = null;
  private lastErrorLogAt = 0;

  // Prefix for every key, so EuroLoo can share a Redis server with other apps
  readonly keyPrefix = 'euroloo:';

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.log('REDIS_URL not set; using in-memory cache and rate limits');
      return;
    }

    this.client = createClient({
      url,
      // Fail fast while disconnected instead of queueing commands
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries: number) => Math.min(retries * 500, 10_000),
      },
    });
    // Without a listener, connection errors would crash the process
    this.client.on('error', (error: Error) => this.logError('Redis error', error));
    this.client.on('ready', () => this.logger.log('Connected to Redis'));
    // Connect in the background so startup never waits on Redis
    this.client.connect().catch((error: Error) => this.logError('Redis connection failed', error));
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) await this.client.quit().catch(() => undefined);
  }

  get isAvailable(): boolean {
    return this.client?.isReady ?? false;
  }

  // Runs a command against Redis; returns null if Redis is off, down or slow
  async run<T>(command: (client: Client) => Promise<T>): Promise<T | null> {
    if (!this.client || !this.client.isReady) return null;
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        command(this.client),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Redis command timed out')), COMMAND_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      this.logError('Redis command failed', error);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private logError(message: string, error: unknown) {
    const now = Date.now();
    if (now - this.lastErrorLogAt < ERROR_LOG_INTERVAL_MS) return;
    this.lastErrorLogAt = now;
    this.logger.warn(`${message}: ${error instanceof Error ? error.message : String(error)}; falling back to memory`);
  }
}
