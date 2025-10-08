/**
 * Filter plugin exports
 *
 * This file is a centralized management file for registering and exporting all filter plugins.
 */

import { filterManager, registerFilter } from '../plugin-system';
import { BlurFilterPlugins } from './blur-plugins';
import { ColorFilterPlugins } from './color-plugins';
import { EffectFilterPlugins } from './effect-plugins';
import { debugLog, productionLog } from '../../utils/debug';

/**
 * All default filter plugins
 *
 * @description Array containing all default filter plugins from color, effect, and blur categories
 * Automatically registered during library initialization.
 */
export const AllFilterPlugins = [...ColorFilterPlugins, ...EffectFilterPlugins, ...BlurFilterPlugins];

/**
 * Automatically register all default filter plugins
 *
 * @description Called once during library initialization to register all default filters to filterManager.
 * Outputs registration success/failure statistics to console.
 */
export function registerDefaultFilters(): void {
  debugLog.debug('Registering default filter plugins...');

  let registeredCount = 0;
  let failedCount = 0;

  for (const plugin of AllFilterPlugins) {
    try {
      registerFilter(plugin);
      registeredCount++;
    } catch (error) {
      productionLog.error(`Filter plugin '${plugin.name}' registration failed:`, error);
      failedCount++;
    }
  }

  debugLog.debug(`Filter plugin registration completed: ${registeredCount} successful, ${failedCount} failed`);

  // Output system information (development mode only)
  if (process.env.NODE_ENV === 'development') {
    const systemInfo = filterManager.getSystemInfo();
    debugLog.debug('Filter system information:', systemInfo);
  }
}

/**
 * Initialize plugin system
 *
 * @description Automatically called when library loads to initialize filter system.
 * Registers default filters and exposes filter API to global object.
 */
export function initializeFilterSystem(): void {
  // Register default filters
  registerDefaultFilters();

  // Expose registration functions to global object for developers to register additional plugins
  if (typeof window !== 'undefined') {
    // Browser environment
    (window as any).WebImageUtil = {
      ...((window as any).WebImageUtil || {}),
      filters: {
        register: registerFilter,
        manager: filterManager,
      },
    };
  } else if (typeof global !== 'undefined') {
    // Node.js environment
    (global as any).WebImageUtil = {
      ...((global as any).WebImageUtil || {}),
      filters: {
        register: registerFilter,
        manager: filterManager,
      },
    };
  }
}

// Automatic initialization on library load
initializeFilterSystem();

// Export individual plugin categories for convenience
export { BlurFilterPlugins } from './blur-plugins';
export { ColorFilterPlugins } from './color-plugins';
export { EffectFilterPlugins } from './effect-plugins';

// Re-export core elements of plugin system
export { applyFilter, applyFilterChain, filterManager, getAvailableFilters, registerFilter } from '../plugin-system';
export type {
  BlendMode,
  FilterCategory,
  FilterChain,
  FilterOptions,
  FilterPlugin,
  FilterValidationResult,
} from '../plugin-system';
