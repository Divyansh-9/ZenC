import React from 'react';
import { usePerformance } from '../contexts/PerformanceContext';
import { useAdaptiveStyles } from '../lib/adaptive-styles';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  systemInfo: {
    platform: string;
    isWindows: boolean;
    sandboxPath: string;
  } | null;
}

const Header: React.FC<HeaderProps> = ({ darkMode, onToggleDarkMode, systemInfo }) => {
  const { profile } = usePerformance();
  const styles = useAdaptiveStyles(profile);

  const logoGradient = styles?.gradientNavy() || 'bg-navy-600';
  const transition = styles?.buttonTransition || '';
  const tierBadge = styles?.tierBadge;

  return (
    <header className="bg-navy-700 dark:bg-navy-900 border-b-2 border-gold-500 shadow-xl">
      <div className="container mx-auto px-6 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo & Branding */}
          <div className="flex items-center gap-5">
            <div className={`w-12 h-12 ${logoGradient} rounded-lg flex items-center justify-center text-white font-black text-2xl shadow-2xl border-2 border-gold-400`}>
              Z
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                ZenCube
              </h1>
              <p className="text-xs text-gold-300 font-semibold tracking-wide uppercase">
                Enterprise Process Isolation Platform
              </p>
            </div>
          </div>

          {/* System Info & Controls */}
          <div className="flex items-center gap-4">
            {/* Performance Tier Badge */}
            {tierBadge && (
              <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 ${tierBadge.className} rounded-lg text-xs font-bold shadow-md`}>
                {tierBadge.text}
              </div>
            )}

            {/* Platform Badge */}
            {systemInfo && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-gold-500/30 rounded-lg text-sm font-medium shadow-md">
                <span className="text-gold-400">
                  {systemInfo.isWindows ? '🪟 WSL Mode' : '🐧 Native Linux'}
                </span>
              </div>
            )}
            
            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className={`p-3 rounded-lg bg-slate-800 border-2 border-gold-500/30 hover:border-gold-400 hover:bg-slate-700 ${transition} shadow-md`}
              aria-label="Toggle dark mode"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* System Capabilities Info (small, professional) */}
        {profile && (
          <div className="mt-3 pt-3 border-t border-gold-500/20 flex items-center gap-6 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-gold-400 font-semibold">CPU:</span>
              <span>{profile.cpuCores} Cores</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gold-400 font-semibold">RAM:</span>
              <span>{profile.memoryGB}GB</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gold-400 font-semibold">GPU:</span>
              <span className="capitalize">{profile.gpuTier}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gold-400 font-semibold">Refresh:</span>
              <span>{profile.chartUpdateInterval}ms</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
