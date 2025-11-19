/**
 * Hardware Performance Profiler
 * 
 * Detects system capabilities and automatically adjusts UI performance settings:
 * - Animation complexity (high/medium/low/none)
 * - Chart update frequency (real-time vs batched)
 * - Data retention (chart points)
 * - Visual effects (shadows, blur, gradients)
 * 
 * Runs on app startup and adapts to ANY hardware configuration globally.
 */

export type PerformanceTier = 'potato' | 'low' | 'medium' | 'high' | 'ultra';

export interface PerformanceProfile {
  tier: PerformanceTier;
  cpuCores: number;
  memoryGB: number;
  gpuTier: 'integrated' | 'dedicated' | 'unknown';
  
  // UI Settings
  enableAnimations: boolean;
  animationDuration: number; // milliseconds
  chartUpdateInterval: number; // milliseconds
  maxChartPoints: number;
  enableBlur: boolean;
  enableGradients: boolean;
  enableShadows: boolean;
  terminalBufferSize: number; // lines
  
  // IPC Batching
  terminalBatchInterval: number; // milliseconds
  monitoringBatchInterval: number; // milliseconds
}

class PerformanceProfiler {
  private profile: PerformanceProfile | null = null;

  /**
   * Detect hardware and create adaptive performance profile
   */
  async detect(): Promise<PerformanceProfile> {
    console.log('[PerformanceProfiler] Starting hardware detection...');
    
    // Get system info from main process
    const systemInfo = await this.getSystemCapabilities();
    
    // Calculate performance tier
    const tier = this.calculateTier(systemInfo);
    
    // Build adaptive profile
    this.profile = this.buildProfile(tier, systemInfo);
    
    console.log('[PerformanceProfiler] Profile created:', this.profile);
    return this.profile;
  }

  /**
   * Get current profile (cached)
   */
  getProfile(): PerformanceProfile {
    if (!this.profile) {
      throw new Error('Performance profile not initialized. Call detect() first.');
    }
    return this.profile;
  }

  /**
   * Query system capabilities via Electron APIs
   */
  private async getSystemCapabilities(): Promise<{
    cpuCores: number;
    memoryGB: number;
    platform: string;
    gpuInfo: string;
  }> {
    try {
      // Use electron API to get hardware info
      const cpuCores = navigator.hardwareConcurrency || 4;
      
      // Estimate memory (performance.memory is non-standard but available in Electron)
      const memoryGB = this.estimateMemory();
      
      // Get platform info
      const systemInfo = await window.sandboxAPI?.getSystemInfo?.() || { platform: 'unknown' };
      
      // GPU detection via canvas (best we can do in renderer)
      const gpuInfo = this.detectGPU();
      
      return {
        cpuCores,
        memoryGB,
        platform: systemInfo.platform || 'unknown',
        gpuInfo,
      };
    } catch (error) {
      console.error('[PerformanceProfiler] Detection failed, using defaults:', error);
      return {
        cpuCores: 4,
        memoryGB: 8,
        platform: 'unknown',
        gpuInfo: 'unknown',
      };
    }
  }

  /**
   * Estimate available memory
   */
  private estimateMemory(): number {
    try {
      // Try performance.memory API (Chrome/Electron)
      const perf = (performance as any).memory;
      if (perf && perf.jsHeapSizeLimit) {
        // jsHeapSizeLimit is in bytes, typically ~2GB on 8GB systems
        const estimatedGB = Math.round((perf.jsHeapSizeLimit / (1024 ** 3)) * 4);
        return Math.max(4, Math.min(estimatedGB, 64)); // Clamp between 4-64GB
      }
    } catch (e) {
      // Silently fail
    }
    
    // Default assumption
    return 8;
  }

  /**
   * Detect GPU capabilities
   */
  private detectGPU(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'unknown';
      
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
        return renderer.toLowerCase();
      }
      
      return 'webgl-capable';
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * Calculate performance tier based on hardware
   */
  private calculateTier(system: {
    cpuCores: number;
    memoryGB: number;
    gpuInfo: string;
  }): PerformanceTier {
    let score = 0;

    // CPU scoring (0-40 points)
    if (system.cpuCores >= 16) score += 40;
    else if (system.cpuCores >= 8) score += 30;
    else if (system.cpuCores >= 4) score += 20;
    else score += 10;

    // Memory scoring (0-30 points)
    if (system.memoryGB >= 32) score += 30;
    else if (system.memoryGB >= 16) score += 25;
    else if (system.memoryGB >= 8) score += 20;
    else if (system.memoryGB >= 4) score += 10;
    else score += 5;

    // GPU scoring (0-30 points)
    const gpuLower = system.gpuInfo.toLowerCase();
    if (gpuLower.includes('nvidia') || gpuLower.includes('radeon') || gpuLower.includes('geforce')) {
      score += 30; // Dedicated GPU
    } else if (gpuLower.includes('apple') || gpuLower.includes('m1') || gpuLower.includes('m2') || gpuLower.includes('m3')) {
      score += 28; // Apple Silicon (excellent integrated)
    } else if (gpuLower.includes('intel') || gpuLower.includes('iris')) {
      score += 15; // Intel integrated
    } else if (gpuLower.includes('webgl')) {
      score += 10; // Basic WebGL
    } else {
      score += 5; // Unknown
    }

    // Map score to tier
    if (score >= 85) return 'ultra';      // High-end workstation (16+ cores, 32GB+, dedicated GPU)
    if (score >= 70) return 'high';       // Modern gaming PC (8+ cores, 16GB+, good GPU)
    if (score >= 50) return 'medium';     // Standard laptop (4-8 cores, 8-16GB, integrated GPU)
    if (score >= 35) return 'low';        // Budget laptop (2-4 cores, 4-8GB)
    return 'potato';                      // Ancient hardware (<2 cores, <4GB)
  }

  /**
   * Build adaptive performance profile for tier
   */
  private buildProfile(tier: PerformanceTier, system: any): PerformanceProfile {
    const profiles: Record<PerformanceTier, Partial<PerformanceProfile>> = {
      ultra: {
        enableAnimations: true,
        animationDuration: 300,
        chartUpdateInterval: 100,        // Real-time updates (10 FPS)
        maxChartPoints: 120,              // 2 minutes of data
        enableBlur: true,
        enableGradients: true,
        enableShadows: true,
        terminalBufferSize: 10000,
        terminalBatchInterval: 50,        // 50ms batching (butter smooth)
        monitoringBatchInterval: 500,     // 500ms (2 FPS for monitoring)
      },
      high: {
        enableAnimations: true,
        animationDuration: 250,
        chartUpdateInterval: 250,         // 4 FPS updates
        maxChartPoints: 90,               // 1.5 minutes
        enableBlur: true,
        enableGradients: true,
        enableShadows: true,
        terminalBufferSize: 5000,
        terminalBatchInterval: 100,       // 100ms batching
        monitoringBatchInterval: 1000,    // 1 second batching
      },
      medium: {
        enableAnimations: true,
        animationDuration: 200,
        chartUpdateInterval: 500,         // 2 FPS updates
        maxChartPoints: 60,               // 1 minute (current default)
        enableBlur: false,                // Disable backdrop-blur
        enableGradients: true,
        enableShadows: false,             // Disable shadows
        terminalBufferSize: 3000,
        terminalBatchInterval: 200,       // 200ms batching
        monitoringBatchInterval: 1000,    // 1 second
      },
      low: {
        enableAnimations: false,          // Disable all animations
        animationDuration: 0,
        chartUpdateInterval: 1000,        // 1 FPS updates
        maxChartPoints: 40,               // 40 seconds
        enableBlur: false,
        enableGradients: false,           // Solid colors only
        enableShadows: false,
        terminalBufferSize: 1000,
        terminalBatchInterval: 300,       // 300ms batching
        monitoringBatchInterval: 2000,    // 2 seconds
      },
      potato: {
        enableAnimations: false,
        animationDuration: 0,
        chartUpdateInterval: 2000,        // 0.5 FPS updates
        maxChartPoints: 30,               // 30 seconds
        enableBlur: false,
        enableGradients: false,
        enableShadows: false,
        terminalBufferSize: 500,
        terminalBatchInterval: 500,       // 500ms batching
        monitoringBatchInterval: 3000,    // 3 seconds
      },
    };

    return {
      tier,
      cpuCores: system.cpuCores,
      memoryGB: system.memoryGB,
      gpuTier: this.classifyGPU(system.gpuInfo),
      ...profiles[tier],
    } as PerformanceProfile;
  }

  /**
   * Classify GPU type
   */
  private classifyGPU(gpuInfo: string): 'integrated' | 'dedicated' | 'unknown' {
    const lower = gpuInfo.toLowerCase();
    if (lower.includes('nvidia') || lower.includes('radeon') || lower.includes('geforce')) {
      return 'dedicated';
    }
    if (lower.includes('intel') || lower.includes('iris') || lower.includes('apple') || lower.includes('uhd')) {
      return 'integrated';
    }
    return 'unknown';
  }
}

// Singleton instance
export const performanceProfiler = new PerformanceProfiler();
