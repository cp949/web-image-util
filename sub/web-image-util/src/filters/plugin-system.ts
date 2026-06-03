/**
 * 필터 등록과 실행을 담당하는 플러그인 기반 필터 시스템이다.
 */

import { debugLog, productionLog } from '../utils/debug';
import { BlendMode } from './filter-blend-mode';
import { applyBlendMode, applyOpacity } from './filter-blending';
import { createFilterNotFoundError, createInvalidFilterParamsError } from './filter-errors';

/**
 * 모든 필터 플러그인이 구현해야 하는 기본 계약이다.
 *
 * @template TParams 필터 파라미터 타입
 */
export interface FilterPlugin<TParams = unknown> {
  /** 고유한 필터 이름 */
  readonly name: string;

  /** 필터 설명 */
  readonly description?: string;

  /** 필터 분류 */
  readonly category: FilterCategory;

  /** 기본 파라미터 */
  readonly defaultParams: TParams;

  /**
   * 이미지 데이터에 필터를 적용한다.
   *
   * @param imageData 원본 이미지 데이터
   * @param params 필터 파라미터
   * @returns 필터가 적용된 이미지 데이터
   */
  apply(imageData: ImageData, params: TParams): ImageData;

  /**
   * 전달된 파라미터를 검증한다.
   *
   * @param params 검증할 파라미터
   * @returns 검증 결과
   */
  validate(params: TParams): FilterValidationResult;

  /**
   * 작은 샘플 이미지로 빠른 미리보기를 생성한다.
   */
  preview?(imageData: ImageData, params: TParams): ImageData;

  /**
   * 다른 필터와 결합 최적화가 가능한지 판단한다.
   */
  canOptimizeWith?(otherFilter: FilterPlugin<unknown>): boolean;
}

/**
 * 필터 기능 분류 열거형이다.
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

/** 필터 파라미터 검증 결과다. */
export interface FilterValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/** 필터 적용 시 사용하는 옵션이다. */
export interface FilterOptions<TParams = unknown> {
  name: string;
  params: TParams;
  blend?: BlendMode;
  opacity?: number; // 0 ~ 1
  enabled?: boolean; // 필터 활성화 여부
  id?: string; // 체인 내부 식별자
}

export { BlendMode };

/** 여러 필터를 순차 적용할 때 사용하는 체인 설정이다. */
export interface FilterChain {
  filters: FilterOptions[];
  preview?: boolean;
  optimize?: boolean; // 체인 최적화 여부
  name?: string; // 프리셋 등에 사용할 체인 이름
}

/**
 * 활성화된 필터 중 아직 등록되지 않은 필터 이름 목록을 반환한다.
 *
 * @param filters 검사할 필터 목록
 * @returns 등록되지 않은 필터 이름 목록
 */
export function getMissingFilterNames(filters: Array<Pick<FilterOptions, 'name' | 'enabled'>>): string[] {
  return filters
    .filter((filter) => filter.enabled !== false)
    .map((filter) => filter.name)
    .filter((filterName) => !filterManager.hasFilter(filterName));
}

/**
 * 필터 플러그인의 등록, 조회, 실행을 담당하는 중앙 관리자다.
 *
 * 전역에서 동일한 필터 레지스트리를 공유하도록 싱글턴으로 동작한다.
 */
export class FilterPluginManager {
  private static instance: FilterPluginManager | undefined;
  private plugins = new Map<string, FilterPlugin>();
  private categories = new Map<FilterCategory, Set<string>>();

  private constructor() {}

  /** 싱글턴 인스턴스를 반환한다. */
  static getInstance(): FilterPluginManager {
    if (!FilterPluginManager.instance) {
      FilterPluginManager.instance = new FilterPluginManager();
    }
    return FilterPluginManager.instance;
  }

  /**
   * 필터 플러그인을 등록한다.
   *
   * @param plugin 등록할 플러그인
   */
  register<TParams>(plugin: FilterPlugin<TParams>): void {
    if (this.plugins.has(plugin.name)) {
      productionLog.warn(`Filter '${plugin.name}' is already registered. Overwriting with new filter.`);
    }

    this.plugins.set(plugin.name, plugin);

    // 카테고리별 조회를 위해 분류 인덱스를 함께 갱신한다.
    if (!this.categories.has(plugin.category)) {
      this.categories.set(plugin.category, new Set());
    }
    this.categories.get(plugin.category)!.add(plugin.name);

    debugLog.debug(`Filter plugin '${plugin.name}' registration completed`);
  }

  /**
   * 등록된 플러그인을 해제한다.
   *
   * @param name 해제할 플러그인 이름
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
   * 이름으로 등록된 플러그인을 조회한다.
   *
   * @param name 플러그인 이름
   */
  getPlugin(name: string): FilterPlugin | undefined {
    return this.plugins.get(name);
  }

  /** 등록된 모든 플러그인을 반환한다. */
  getAllPlugins(): FilterPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 특정 카테고리에 속한 플러그인을 반환한다.
   *
   * @param category 필터 카테고리
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
      throw createFilterNotFoundError(filterOptions.name);
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
      throw createInvalidFilterParamsError(validation.errors);
    }

    // Apply filter
    let result = plugin.apply(imageData, filterOptions.params);

    // Apply blending and opacity
    if (filterOptions.blend && filterOptions.blend !== BlendMode.NORMAL) {
      result = applyBlendMode(imageData, result, filterOptions.blend);
    }

    if (filterOptions.opacity !== undefined && filterOptions.opacity < 1) {
      result = applyOpacity(imageData, result, filterOptions.opacity);
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
    FilterPluginManager.instance = undefined;
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
export function registerFilter<TParams>(plugin: FilterPlugin<TParams>): void {
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
