/**
 * Adaptive Style Utilities
 * 
 * Provides CSS classes that automatically adapt to hardware performance.
 * Components use these instead of hardcoded Tailwind classes.
 */

import { PerformanceProfile } from './performance-profiler';

export class AdaptiveStyles {
  private profile: PerformanceProfile;

  constructor(profile: PerformanceProfile) {
    this.profile = profile;
  }

  /**
   * Card background with adaptive blur and opacity
   */
  get cardBg(): string {
    const base = 'rounded-lg border border-gray-200 dark:border-gray-700';
    
    if (this.profile.enableBlur) {
      return `${base} bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg`;
    }
    
    return `${base} bg-white dark:bg-gray-800 shadow-md`;
  }

  /**
   * Gradient backgrounds (disabled on low-end hardware)
   */
  gradientBlue(): string {
    if (!this.profile.enableGradients) {
      return 'bg-blue-500';
    }
    return 'bg-gradient-to-br from-blue-500 to-blue-700';
  }

  gradientGold(): string {
    if (!this.profile.enableGradients) {
      return 'bg-gold-500';
    }
    return 'bg-gradient-to-br from-gold-400 to-gold-600';
  }

  gradientNavy(): string {
    if (!this.profile.enableGradients) {
      return 'bg-navy-600';
    }
    return 'bg-gradient-to-br from-navy-500 to-navy-700';
  }

  /**
   * Shadow effects (disabled on low-end hardware)
   */
  get shadow(): string {
    if (!this.profile.enableShadows) {
      return '';
    }
    return 'shadow-lg';
  }

  get shadowSm(): string {
    if (!this.profile.enableShadows) {
      return '';
    }
    return 'shadow-sm';
  }

  /**
   * Transition/animation classes
   */
  get transition(): string {
    if (!this.profile.enableAnimations) {
      return '';
    }
    const duration = this.profile.animationDuration;
    return `transition-all duration-${duration}`;
  }

  get hoverScale(): string {
    if (!this.profile.enableAnimations) {
      return '';
    }
    return 'hover:scale-105 active:scale-95';
  }

  /**
   * Button animations
   */
  get buttonTransition(): string {
    if (!this.profile.enableAnimations) {
      return '';
    }
    return `transition-colors duration-${this.profile.animationDuration}`;
  }

  /**
   * Loading spinners (simplified on low-end)
   */
  get spinner(): string {
    if (!this.profile.enableAnimations) {
      return ''; // No animation
    }
    return 'animate-spin';
  }

  /**
   * Pulse animations for badges
   */
  get pulse(): string {
    if (!this.profile.enableAnimations) {
      return '';
    }
    return 'animate-pulse';
  }

  /**
   * Header gradient (adaptive)
   */
  get headerBg(): string {
    if (this.profile.enableGradients) {
      return 'bg-gradient-to-r from-navy-600 via-navy-700 to-navy-800';
    }
    return 'bg-navy-700';
  }

  /**
   * Status bar blur
   */
  get statusBarBg(): string {
    if (this.profile.enableBlur) {
      return 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-md';
    }
    return 'bg-white dark:bg-gray-800';
  }

  /**
   * Chart gradient fills
   */
  chartGradient(color: string): { useGradient: boolean; gradientId: string } {
    return {
      useGradient: this.profile.enableGradients,
      gradientId: `${color}Gradient`,
    };
  }

  /**
   * Performance tier badge
   */
  get tierBadge(): { text: string; className: string } {
    const { tier } = this.profile;
    
    const badges = {
      ultra: { text: '⚡ ULTRA', className: 'bg-purple-500 text-white' },
      high: { text: '🚀 HIGH', className: 'bg-blue-500 text-white' },
      medium: { text: '⚙️  MEDIUM', className: 'bg-green-500 text-white' },
      low: { text: '🔋 ECO', className: 'bg-yellow-600 text-white' },
      potato: { text: '🥔 SAVER', className: 'bg-gray-500 text-white' },
    };
    
    return badges[tier];
  }
}

/**
 * Hook to get adaptive styles in components
 */
export function useAdaptiveStyles(profile: PerformanceProfile | null): AdaptiveStyles | null {
  if (!profile) return null;
  return new AdaptiveStyles(profile);
}
