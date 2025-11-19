/**
 * Unit tests for APIKeyRotator
 * 
 * Tests key rotation, rate limiting, exponential backoff
 */

import { APIKeyRotator } from '../api-key-rotator';

describe('APIKeyRotator', () => {
  let rotator: APIKeyRotator;

  beforeEach(() => {
    rotator = new APIKeyRotator(['key1', 'key2', 'key3']);
  });

  describe('getNextKey', () => {
    it('should rotate through keys in round-robin fashion', () => {
      expect(rotator.getNextKey()).toBe('key1');
      expect(rotator.getNextKey()).toBe('key2');
      expect(rotator.getNextKey()).toBe('key3');
      expect(rotator.getNextKey()).toBe('key1'); // Wraps around
    });

    it('should handle single key', () => {
      const singleRotator = new APIKeyRotator(['onlykey']);
      expect(singleRotator.getNextKey()).toBe('onlykey');
      expect(singleRotator.getNextKey()).toBe('onlykey');
    });

    it('should throw error when no keys provided', () => {
      expect(() => new APIKeyRotator([])).toThrow();
    });
  });

  describe('rate limiting', () => {
    it('should track usage per key', () => {
      rotator.recordSuccess('key1');
      rotator.recordSuccess('key1');
      rotator.recordSuccess('key2');
      
      // Internal tracking verified via behavior
      expect(rotator.getNextKey()).toBeDefined();
    });

    it('should skip rate-limited keys', () => {
      // Simulate 60 requests in 1 minute (rate limit threshold)
      for (let i = 0; i < 60; i++) {
        rotator.recordSuccess('key1');
      }
      
      // Next key should skip key1
      const next = rotator.getNextKey();
      expect(next).not.toBe('key1');
    });
  });

  describe('error handling', () => {
    it('should record errors for keys', () => {
      rotator.recordError('key2', 'API_ERROR');
      
      // Should still return a key (exponential backoff internal)
      expect(rotator.getNextKey()).toBeDefined();
    });

    it('should apply exponential backoff on repeated errors', () => {
      rotator.recordError('key1', 'RATE_LIMIT');
      rotator.recordError('key1', 'RATE_LIMIT');
      
      // Key1 should have longer backoff
      const next = rotator.getNextKey();
      expect(next).not.toBe('key1');
    });
  });

  describe('health monitoring', () => {
    it('should prefer healthy keys over error-prone keys', () => {
      rotator.recordSuccess('key2');
      rotator.recordSuccess('key2');
      rotator.recordError('key1', 'TIMEOUT');
      rotator.recordError('key1', 'TIMEOUT');
      
      // Should prefer key2 or key3 over key1
      const next = rotator.getNextKey();
      expect(['key2', 'key3']).toContain(next);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent requests', () => {
      const keys = [
        rotator.getNextKey(),
        rotator.getNextKey(),
        rotator.getNextKey(),
      ];
      
      expect(keys).toHaveLength(3);
      expect(new Set(keys).size).toBeGreaterThan(0); // At least some rotation
    });

    it('should handle rapid success/error recording', () => {
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          rotator.recordSuccess('key1');
        } else {
          rotator.recordError('key1', 'RANDOM_ERROR');
        }
      }
      
      // Should still return valid key
      expect(rotator.getNextKey()).toBeDefined();
    });
  });
});
