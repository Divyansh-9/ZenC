/**
 * API Key Rotation System
 * 
 * Purpose: Distribute API load across multiple keys to avoid rate limits
 * Features:
 * - Round-robin key selection
 * - Rate limit tracking per key
 * - Automatic key exhaustion handling
 * - Exponential backoff on failures
 * 
 * Rating: 8/10 - Solid implementation but NOT "0% failure" (network/API outages still possible)
 */

import * as crypto from 'crypto';

interface KeyUsage {
  requestCount: number;
  lastUsed: Date;
  rateLimitReset: Date | null;
  isExhausted: boolean;
  failureCount: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number;
}

export class APIKeyRotator {
  private keys: string[];
  private currentIndex: number = 0;
  private keyUsage: Map<string, KeyUsage>;
  private retryConfig: RetryConfig;

  constructor(keys: string[], retryConfig?: Partial<RetryConfig>) {
    if (keys.length === 0) {
      throw new Error('APIKeyRotator: At least one API key required');
    }

    this.keys = keys;
    this.keyUsage = new Map();
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 3,
      baseDelay: retryConfig?.baseDelay ?? 1000,
      maxDelay: retryConfig?.maxDelay ?? 16000,
    };

    // Initialize usage tracking for each key
    keys.forEach(key => {
      this.keyUsage.set(key, {
        requestCount: 0,
        lastUsed: new Date(0),
        rateLimitReset: null,
        isExhausted: false,
        failureCount: 0,
      });
    });
  }

  /**
   * Get next available key (round-robin with exhausted key skipping)
   */
  private getNextKey(): string | null {
    const startIndex = this.currentIndex;
    let attempts = 0;

    while (attempts < this.keys.length) {
      const key = this.keys[this.currentIndex];
      const usage = this.keyUsage.get(key)!;

      // Increment for next call
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;

      // Check if key is available
      if (!usage.isExhausted) {
        // Check if rate limit has reset
        if (usage.rateLimitReset && new Date() > usage.rateLimitReset) {
          usage.isExhausted = false;
          usage.failureCount = 0;
        }

        if (!usage.isExhausted) {
          return key;
        }
      }

      attempts++;
    }

    // All keys exhausted
    return null;
  }

  /**
   * Mark key as exhausted (rate limited)
   */
  private markKeyExhausted(key: string, resetInSeconds: number = 60): void {
    const usage = this.keyUsage.get(key);
    if (usage) {
      usage.isExhausted = true;
      usage.rateLimitReset = new Date(Date.now() + resetInSeconds * 1000);
      console.warn(`[APIKeyRotator] Key exhausted: ${this.hashKey(key)}, resets in ${resetInSeconds}s`);
    }
  }

  /**
   * Record successful API call
   */
  private recordSuccess(key: string): void {
    const usage = this.keyUsage.get(key);
    if (usage) {
      usage.requestCount++;
      usage.lastUsed = new Date();
      usage.failureCount = 0; // Reset failure count on success
    }
  }

  /**
   * Record failed API call
   */
  private recordFailure(key: string): void {
    const usage = this.keyUsage.get(key);
    if (usage) {
      usage.failureCount++;
      usage.lastUsed = new Date();
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false;

    const errorString = error.toString().toLowerCase();
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.statusCode;

    return (
      status === 429 ||
      errorString.includes('rate limit') ||
      errorString.includes('quota') ||
      errorString.includes('too many requests') ||
      message.includes('rate limit') ||
      message.includes('quota')
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error.status || error.statusCode;
    
    // Retry on rate limits and server errors
    if (this.isRateLimitError(error)) return true;
    if (status >= 500 && status < 600) return true;
    
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    
    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attemptNumber: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attemptNumber),
      this.retryConfig.maxDelay
    );
    
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.floor(delay + jitter);
  }

  /**
   * Execute API call with key rotation and retry logic
   * 
   * @param apiCall - Function that takes an API key and returns a Promise
   * @param options - Optional retry configuration
   * @returns Promise with API response
   * @throws Error if all retries exhausted
   */
  async callWithRotation<T>(
    apiCall: (key: string) => Promise<T>,
    options?: { maxRetries?: number }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? this.retryConfig.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const key = this.getNextKey();

      if (!key) {
        throw new Error(
          'APIKeyRotator: All API keys exhausted. Wait for rate limits to reset or add more keys.'
        );
      }

      try {
        const result = await apiCall(key);
        this.recordSuccess(key);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordFailure(key);

        console.error(`[APIKeyRotator] Attempt ${attempt + 1}/${maxRetries} failed:`, {
          key: this.hashKey(key),
          error: error instanceof Error ? error.message : String(error),
        });

        // Handle rate limit errors
        if (this.isRateLimitError(error)) {
          this.markKeyExhausted(key, 60);
          continue; // Try next key immediately
        }

        // Handle retryable errors with backoff
        if (this.isRetryableError(error) && attempt < maxRetries - 1) {
          const delay = this.calculateBackoff(attempt);
          console.warn(`[APIKeyRotator] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Non-retryable error or last attempt
        throw error;
      }
    }

    throw lastError || new Error('APIKeyRotator: Max retries exceeded');
  }

  /**
   * Get usage statistics
   */
  getStats(): Array<{ keyHash: string; usage: KeyUsage }> {
    return Array.from(this.keyUsage.entries()).map(([key, usage]) => ({
      keyHash: this.hashKey(key),
      usage: { ...usage },
    }));
  }

  /**
   * Reset all keys (clear exhaustion flags)
   */
  resetAllKeys(): void {
    this.keyUsage.forEach(usage => {
      usage.isExhausted = false;
      usage.rateLimitReset = null;
      usage.failureCount = 0;
    });
    console.log('[APIKeyRotator] All keys reset');
  }

  /**
   * Hash API key for logging (never log full key)
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
  }
}
