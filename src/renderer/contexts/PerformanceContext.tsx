/**
 * Performance Context
 * 
 * Provides performance profile to all components via React Context.
 * Detects hardware on mount and applies adaptive settings globally.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { performanceProfiler, PerformanceProfile } from '../lib/performance-profiler';

interface PerformanceContextType {
  profile: PerformanceProfile | null;
  isDetecting: boolean;
}

const PerformanceContext = createContext<PerformanceContextType>({
  profile: null,
  isDetecting: true,
});

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within PerformanceProvider');
  }
  return context;
};

interface PerformanceProviderProps {
  children: ReactNode;
}

export const PerformanceProvider: React.FC<PerformanceProviderProps> = ({ children }) => {
  const [profile, setProfile] = useState<PerformanceProfile | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    let mounted = true;

    const detectHardware = async () => {
      try {
        console.log('[PerformanceProvider] Starting hardware detection...');
        const detectedProfile = await performanceProfiler.detect();
        
        if (mounted) {
          setProfile(detectedProfile);
          setIsDetecting(false);
          
          // Log to console for transparency
          console.log(`
╔════════════════════════════════════════════════════════════╗
║           🚀 ADAPTIVE PERFORMANCE PROFILE 🚀              ║
╠════════════════════════════════════════════════════════════╣
║  Tier:              ${detectedProfile.tier.toUpperCase().padEnd(38)}║
║  CPU Cores:         ${String(detectedProfile.cpuCores).padEnd(38)}║
║  Memory:            ${detectedProfile.memoryGB}GB${' '.repeat(35)}║
║  GPU:               ${detectedProfile.gpuTier.padEnd(38)}║
╠════════════════════════════════════════════════════════════╣
║  Animations:        ${(detectedProfile.enableAnimations ? 'ENABLED' : 'DISABLED').padEnd(38)}║
║  Animation Speed:   ${detectedProfile.animationDuration}ms${' '.repeat(35)}║
║  Chart Updates:     ${detectedProfile.chartUpdateInterval}ms${' '.repeat(34)}║
║  Chart Points:      ${String(detectedProfile.maxChartPoints).padEnd(38)}║
║  Blur Effects:      ${(detectedProfile.enableBlur ? 'ENABLED' : 'DISABLED').padEnd(38)}║
║  Gradients:         ${(detectedProfile.enableGradients ? 'ENABLED' : 'DISABLED').padEnd(38)}║
║  Shadows:           ${(detectedProfile.enableShadows ? 'ENABLED' : 'DISABLED').padEnd(38)}║
╚════════════════════════════════════════════════════════════╝
          `);
        }
      } catch (error) {
        console.error('[PerformanceProvider] Detection failed:', error);
        if (mounted) {
          setIsDetecting(false);
        }
      }
    };

    detectHardware();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PerformanceContext.Provider value={{ profile, isDetecting }}>
      {children}
    </PerformanceContext.Provider>
  );
};
