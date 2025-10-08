/**
 * New plugin-based filter system
 *
 * Key features:
 * - Plugin registration and dynamic loading support
 * - Enhanced type safety
 * - Filter chain optimization
 * - Custom filter support
 */

import { debugLog, productionLog } from '../utils/debug';

/**
 * Base filter plugin interface
 *
 * @description Interface that all filter plugins must implement
 * Ensures type safety and consistent API.
 * @template TParams Filter parameter type
 */
export interface FilterPlugin<TParams = any> {
  /** Unique filter name */
  readonly name: string;

  /** Filter description */
  readonly description?: string;

  /** Filter category */
  readonly category: FilterCategory;

  /** Default parameters */
  readonly defaultParams: TParams;

  /**
   * Filter application function
   * @param imageData - Original image data
   * @param params - Filter parameters
   * @returns Image data with filter applied
   */
  apply(imageData: ImageData, params: TParams): ImageData;

  /**
   * Parameter validation
   * @param params - Parameters to validate
   * @returns Validation result
   */
  validate(params: TParams): FilterValidationResult;

  /**
   * Filter preview (optional)
   * Generate quick preview with small sample image
   */
  preview?(imageData: ImageData, params: TParams): ImageData;

  /**
   * Filter optimization compatibility
   * Check if can be optimized by combining with other filters
   */
  canOptimizeWith?(otherFilter: FilterPlugin): boolean;
}

/**
 * Filter categories
 *
 * @description Enum for categorizing filters by functionality
 * Used by filter manager for category-based management.
 */
export enum FilterCategory {
  COLOR = 'color',
  EFFECT = 'effect',
  DISTORTION = 'distortion',
  BLUR = 'blur',
  SHARPEN = 'sharpen',
  ARTISTIC = 'artistic',
  CUSTOM = 'custom',
}

/**
 * Filter validation result
 */
export interface FilterValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Filter application options
 */
export interface FilterOptions<TParams = any> {
  name: string;
  params: TParams;
  blend?: BlendMode;
  opacity?: number; // 0 ~ 1
  enabled?: boolean; // Filter enabled state
  id?: string; // For filter identification in chain
}

/**
 * Blend modes (extended)
 *
 * @description Enum defining how filters are composited with original images
 * Provides effects similar to CSS blend-mode.
 */
export enum BlendMode {
  NORMAL = 'normal',
  MULTIPLY = 'multiply',
  SCREEN = 'screen',
  OVERLAY = 'overlay',
  SOFT_LIGHT = 'soft-light',
  HARD_LIGHT = 'hard-light',
  COLOR_DODGE = 'color-dodge',
  COLOR_BURN = 'color-burn',
  DARKEN = 'darken',
  LIGHTEN = 'lighten',
  DIFFERENCE = 'difference',
  EXCLUSION = 'exclusion',
}

/**
 * Filter chain
 */
export interface FilterChain {
  filters: FilterOptions[];
  preview?: boolean;
  optimize?: boolean; // Whether to optimize chain
  name?: string; // Chain name (for presets)
}

/**
 * Filter plugin manager
 *
 * @description Central management class responsible for registration, management, and application of filter plugins
 * Implemented as singleton pattern to provide consistent filter management globally.
 */
export class FilterPluginManager {
  private static instance: FilterPluginManager;
  private plugins = new Map<string, FilterPlugin>();
  private categories = new Map<FilterCategory, Set<string>>();

  private constructor() {}

  /**
   * Return singleton instance
   */
  static getInstance(): FilterPluginManager {
    if (!FilterPluginManager.instance) {
      FilterPluginManager.instance = new FilterPluginManager();
    }
    return FilterPluginManager.instance;
  }

  /**
   * Register filter plugin
   * @param plugin - Plugin to register
   */
  register<TParams>(plugin: FilterPlugin<TParams>): void {
    if (this.plugins.has(plugin.name)) {
      productionLog.warn(`Filter '${plugin.name}' is already registered. Overwriting with new filter.`);
    }

    this.plugins.set(plugin.name, plugin);

    // Categorize by category
    if (!this.categories.has(plugin.category)) {
      this.categories.set(plugin.category, new Set());
    }
    this.categories.get(plugin.category)!.add(plugin.name);

    debugLog.debug(`Filter plugin '${plugin.name}' registration completed`);
  }

  /**
   * Unregister plugin
   * @param name - Name of plugin to unregister
   */
  unregister(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    this.plugins.delete(name);
    this.categories.get(plugin.category)?.delete(name);

    debugLog.debug(`Filter plugin '${name}' unregistration completed`);
    return true;
  }

  /**
   * Return registered plugin
   * @param name - Plugin name
   */
  getPlugin(name: string): FilterPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Return all registered plugins
   */
  getAllPlugins(): FilterPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Return plugins by category
   * @param category - Filter category
   */
  getPluginsByCategory(category: FilterCategory): FilterPlugin[] {
    const names = this.categories.get(category) || new Set();
    return Array.from(names)
      .map((name) => this.plugins.get(name)!)
      .filter(Boolean);
  }

  /**
   * Return all available filter names
   */
  getAvailableFilters(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Check if filter is registered
   * @param name - Filter name to check
   */
  hasFilter(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Apply single filter
   * @param imageData - Original image data
   * @param filterOptions - Filter options
   * @returns Image data with filter applied
   */
  applyFilter(imageData: ImageData, filterOptions: FilterOptions): ImageData {
    const plugin = this.plugins.get(filterOptions.name);
    if (!plugin) {
      throw new Error(`Filter '${filterOptions.name}' not found.`);
    }

    // Return original if filter is disabled
    if (filterOptions.enabled === false) {
      const copiedData = new Uint8ClampedArray(imageData.data.length);
      copiedData.set(imageData.data);
      return new ImageData(copiedData, imageData.width, imageData.height);
    }

    // Parameter validation
    const validation = plugin.validate(filterOptions.params);
    if (!validation.valid) {
      throw new Error(`Filter parameters are invalid: ${validation.errors?.join(', ')}`);
    }

    // Apply filter
    let result = plugin.apply(imageData, filterOptions.params);

    // Apply blending and opacity
    if (filterOptions.blend && filterOptions.blend !== BlendMode.NORMAL) {
      result = this.applyBlendMode(imageData, result, filterOptions.blend);
    }

    if (filterOptions.opacity !== undefined && filterOptions.opacity < 1) {
      result = this.applyOpacity(imageData, result, filterOptions.opacity);
    }

    return result;
  }

  /**
   * Apply filter chain
   * @param imageData - Original image data
   * @param filterChain - Filter chain to apply
   * @returns Image data with all filters applied
   */
  applyFilterChain(imageData: ImageData, filterChain: FilterChain): ImageData {
    // Create ImageData copy
    const copiedData = new Uint8ClampedArray(imageData.data.length);
    copiedData.set(imageData.data);
    let result = new ImageData(copiedData, imageData.width, imageData.height);

    // When optimization option is enabled
    const filters = filterChain.optimize ? this.optimizeFilterChain(filterChain.filters) : filterChain.filters;

    // Apply only enabled filters
    const enabledFilters = filters.filter((filter) => filter.enabled !== false);

    for (const filterOption of enabledFilters) {
      result = this.applyFilter(result, filterOption);
    }

    return result;
  }

  /**
   * Optimize filter chain
   * Combine filters of same category or remove unnecessary filters
   * @param filters - Filter array to optimize
   * @returns Optimized filter array
   */
  private optimizeFilterChain(filters: FilterOptions[]): FilterOptions[] {
    const optimized: FilterOptions[] = [];
    const colorFilters: FilterOptions[] = [];

    for (const filter of filters) {
      const plugin = this.plugins.get(filter.name);
      if (!plugin) continue;

      // Collect color filters separately to check combination possibility
      if (plugin.category === FilterCategory.COLOR) {
        colorFilters.push(filter);
      } else {
        // Process color filters first if they are accumulated
        if (colorFilters.length > 0) {
          optimized.push(...this.mergeColorFilters(colorFilters));
          colorFilters.length = 0;
        }
        optimized.push(filter);
      }
    }

    // Process remaining color filters
    if (colorFilters.length > 0) {
      optimized.push(...this.mergeColorFilters(colorFilters));
    }

    return optimized;
  }

  /**
   * Merge color filters
   * @param colorFilters - Color filters to merge
   * @returns Merged filter array
   */
  private mergeColorFilters(colorFilters: FilterOptions[]): FilterOptions[] {
    // Currently simple implementation, more complex merge logic needed in practice
    return colorFilters;
  }

  /**
   * Apply blend mode
   * @param original - Original image data
   * @param filtered - Filtered image data
   * @param blendMode - Blend mode
   * @returns Blended image data
   */
  private applyBlendMode(original: ImageData, filtered: ImageData, blendMode: BlendMode): ImageData {
    const result = new Uint8ClampedArray(original.data.length);
    const origData = original.data;
    const filtData = filtered.data;

    for (let i = 0; i < origData.length; i += 4) {
      const [r1, g1, b1] = [origData[i] / 255, origData[i + 1] / 255, origData[i + 2] / 255];
      const [r2, g2, b2] = [filtData[i] / 255, filtData[i + 1] / 255, filtData[i + 2] / 255];

      let [rResult, gResult, bResult] = [r2, g2, b2];

      switch (blendMode) {
        case BlendMode.MULTIPLY:
          rResult = r1 * r2;
          gResult = g1 * g2;
          bResult = b1 * b2;
          break;
        case BlendMode.SCREEN:
          rResult = 1 - (1 - r1) * (1 - r2);
          gResult = 1 - (1 - g1) * (1 - g2);
          bResult = 1 - (1 - b1) * (1 - b2);
          break;
        case BlendMode.OVERLAY:
          rResult = r1 < 0.5 ? 2 * r1 * r2 : 1 - 2 * (1 - r1) * (1 - r2);
          gResult = g1 < 0.5 ? 2 * g1 * g2 : 1 - 2 * (1 - g1) * (1 - g2);
          bResult = b1 < 0.5 ? 2 * b1 * b2 : 1 - 2 * (1 - b1) * (1 - b2);
          break;
        // Add other blend modes here
      }

      result[i] = Math.round(rResult * 255);
      result[i + 1] = Math.round(gResult * 255);
      result[i + 2] = Math.round(bResult * 255);
      result[i + 3] = origData[i + 3]; // Preserve alpha
    }

    return new ImageData(result, original.width, original.height);
  }

  /**
   * Apply opacity
   * @param original - Original image data
   * @param filtered - Filtered image data
   * @param opacity - Opacity (0 ~ 1)
   * @returns Image data with opacity applied
   */
  private applyOpacity(original: ImageData, filtered: ImageData, opacity: number): ImageData {
    const result = new Uint8ClampedArray(original.data.length);
    const origData = original.data;
    const filtData = filtered.data;

    for (let i = 0; i < origData.length; i += 4) {
      // Linear interpolation
      result[i] = origData[i] + opacity * (filtData[i] - origData[i]);
      result[i + 1] = origData[i + 1] + opacity * (filtData[i + 1] - origData[i + 1]);
      result[i + 2] = origData[i + 2] + opacity * (filtData[i + 2] - origData[i + 2]);
      result[i + 3] = origData[i + 3]; // Preserve alpha
    }

    return new ImageData(result, original.width, original.height);
  }

  /**
   * Validate filter chain
   * @param filterChain - Filter chain to validate
   * @returns Validation result for the entire chain
   */
  validateFilterChain(filterChain: FilterChain): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < filterChain.filters.length; i++) {
      const filter = filterChain.filters[i];
      const plugin = this.plugins.get(filter.name);

      if (!plugin) {
        errors.push(`Filter '${filter.name}' not found (index: ${i})`);
        continue;
      }

      const validation = plugin.validate(filter.params);
      if (!validation.valid) {
        errors.push(`Filter '${filter.name}' parameter error (index: ${i}): ${validation.errors?.join(', ')}`);
      }

      if (validation.warnings) {
        warnings.push(...validation.warnings.map((w) => `${filter.name}: ${w}`));
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Return plugin system information
   */
  getSystemInfo() {
    return {
      totalPlugins: this.plugins.size,
      categories: Object.fromEntries(
        Array.from(this.categories.entries()).map(([category, plugins]) => [category, plugins.size])
      ),
      plugins: this.getAllPlugins().map((plugin) => ({
        name: plugin.name,
        category: plugin.category,
        description: plugin.description,
      })),
    };
  }

  /**
   * Reset instance for testing
   * @internal Test-only method - do not use in production code
   */
  static resetForTesting(): void {
    if (FilterPluginManager.instance) {
      FilterPluginManager.instance.plugins.clear();
      FilterPluginManager.instance.categories.clear();
    }
    FilterPluginManager.instance = undefined as any;
  }
}

/**
 * Global filter manager instance
 *
 * @description Singleton instance of filter manager used throughout the library
 * All filter plugin management operations are performed through this instance.
 */
export const filterManager = FilterPluginManager.getInstance();

/**
 * Convenience functions
 */
/**
 * Register filter plugin
 *
 * @description Register new filter plugin to global filter manager.
 * @param plugin Filter plugin to register
 */
export function registerFilter(plugin: FilterPlugin<any>): void {
  filterManager.register(plugin);
}

/**
 * Apply single filter
 *
 * @description Apply one filter to image data.
 * @param imageData Original image data
 * @param filterOptions Filter options to apply
 * @returns Image data with filter applied
 */
export function applyFilter(imageData: ImageData, filterOptions: FilterOptions): ImageData {
  return filterManager.applyFilter(imageData, filterOptions);
}

/**
 * Apply filter chain
 *
 * @description Apply multiple filters sequentially.
 * @param imageData Original image data
 * @param filterChain Filter chain to apply
 * @returns Image data with all filters applied
 */
export function applyFilterChain(imageData: ImageData, filterChain: FilterChain): ImageData {
  return filterManager.applyFilterChain(imageData, filterChain);
}

/**
 * Get available filter list
 *
 * @description Return list of names of all currently registered filters.
 * @returns Array of registered filter names
 */
export function getAvailableFilters(): string[] {
  return filterManager.getAvailableFilters();
}
