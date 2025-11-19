import React from 'react';

interface ResourceLimitsProps {
  cpuLimit: number | undefined;
  memLimit: number | undefined;
  procLimit: number | undefined;
  fileSizeLimit: number | undefined;
  onCpuLimitChange: (value: number | undefined) => void;
  onMemLimitChange: (value: number | undefined) => void;
  onProcLimitChange: (value: number | undefined) => void;
  onFileSizeLimitChange: (value: number | undefined) => void;
  disabled: boolean;
}

const PRESETS = [
  { name: 'None', cpu: undefined, mem: undefined, proc: undefined, fsize: undefined },
  { name: 'Light', cpu: 30, mem: 1024, proc: undefined, fsize: undefined },
  { name: 'Medium', cpu: 10, mem: 512, proc: 10, fsize: undefined },
  { name: 'Strict', cpu: 5, mem: 256, proc: 5, fsize: 100 },
];

const ResourceLimits: React.FC<ResourceLimitsProps> = ({
  cpuLimit,
  memLimit,
  procLimit,
  fileSizeLimit,
  onCpuLimitChange,
  onMemLimitChange,
  onProcLimitChange,
  onFileSizeLimitChange,
  disabled,
}) => {
  const applyPreset = (preset: typeof PRESETS[0]) => {
    onCpuLimitChange(preset.cpu);
    onMemLimitChange(preset.mem);
    onProcLimitChange(preset.proc);
    onFileSizeLimitChange(preset.fsize);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Resource Limits
      </h2>

      <div className="space-y-4">
        {/* CPU Limit */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cpuLimit !== undefined}
                onChange={(e) => onCpuLimitChange(e.target.checked ? 5 : undefined)}
                disabled={disabled}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                CPU Time (seconds)
              </span>
            </label>
          </div>
          {cpuLimit !== undefined && (
            <input
              type="number"
              value={cpuLimit}
              onChange={(e) => onCpuLimitChange(parseInt(e.target.value) || 0)}
              disabled={disabled}
              min="1"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
            />
          )}
        </div>

        {/* Memory Limit */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={memLimit !== undefined}
                onChange={(e) => onMemLimitChange(e.target.checked ? 256 : undefined)}
                disabled={disabled}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Memory (MB)
              </span>
            </label>
          </div>
          {memLimit !== undefined && (
            <input
              type="number"
              value={memLimit}
              onChange={(e) => onMemLimitChange(parseInt(e.target.value) || 0)}
              disabled={disabled}
              min="1"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
            />
          )}
        </div>

        {/* Process Limit */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={procLimit !== undefined}
                onChange={(e) => onProcLimitChange(e.target.checked ? 10 : undefined)}
                disabled={disabled}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Processes
              </span>
            </label>
          </div>
          {procLimit !== undefined && (
            <input
              type="number"
              value={procLimit}
              onChange={(e) => onProcLimitChange(parseInt(e.target.value) || 0)}
              disabled={disabled}
              min="1"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
            />
          )}
        </div>

        {/* File Size Limit */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fileSizeLimit !== undefined}
                onChange={(e) => onFileSizeLimitChange(e.target.checked ? 100 : undefined)}
                disabled={disabled}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                File Size (MB)
              </span>
            </label>
          </div>
          {fileSizeLimit !== undefined && (
            <input
              type="number"
              value={fileSizeLimit}
              onChange={(e) => onFileSizeLimitChange(parseInt(e.target.value) || 0)}
              disabled={disabled}
              min="1"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
            />
          )}
        </div>

        {/* Presets */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Presets
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                disabled={disabled}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-primary-100 dark:hover:bg-primary-900 hover:text-primary-700 dark:hover:text-primary-300 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceLimits;
