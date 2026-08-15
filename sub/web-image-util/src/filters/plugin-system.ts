/**
 * 필터 등록과 실행을 담당하는 플러그인 기반 필터 시스템이다.
 *
 * 레지스트리는 이 모듈이 소유하는 private 상태이고 소비자는 아래 모듈 함수만 사용한다.
 * 같은 기능을 매니저 객체와 모듈 함수로 이중 노출하지 않기 위한 의도적 제약이다.
 */

import { debugLog, productionLog } from '../utils/debug.internal';
import { BlendMode } from './filter-blend-mode.internal';
import { applyBlendMode, applyOpacity } from './filter-blending.internal';
import { createFilterNotFoundError, createInvalidFilterParamsError } from './filter-errors.internal';

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
}

export { BlendMode };

/** 여러 필터를 순차 적용할 때 사용하는 체인 설정이다. */
export interface FilterChain {
  filters: FilterOptions[];
}

/**
 * 등록된 플러그인 레지스트리.
 *
 * 모듈 private 상태이므로 실행 중 레지스트리는 항상 하나다.
 * 싱글턴 인스턴스를 별도로 캡처하는 경로가 없어 참조가 갈라질 수 없다.
 */
const registeredPlugins = new Map<string, FilterPlugin>();
const supportedBlendModes = new Set<string>(Object.values(BlendMode));

/**
 * 필터 플러그인을 등록한다.
 *
 * 같은 이름이 이미 있으면 경고 후 덮어쓴다.
 *
 * @param plugin 등록할 플러그인
 */
export function registerFilter<TParams>(plugin: FilterPlugin<TParams>): void {
  if (registeredPlugins.has(plugin.name)) {
    productionLog.warn(`Filter '${plugin.name}' is already registered. Overwriting with new filter.`);
  }

  registeredPlugins.set(plugin.name, plugin);

  debugLog.debug(`Filter plugin '${plugin.name}' registration completed`);
}

/**
 * 필터가 등록되어 있는지 확인한다.
 *
 * @param name 확인할 필터 이름
 */
export function hasFilter(name: string): boolean {
  return registeredPlugins.has(name);
}

/**
 * 등록된 모든 필터 이름을 반환한다.
 *
 * @returns 등록된 필터 이름 배열
 */
export function getAvailableFilters(): string[] {
  return Array.from(registeredPlugins.keys());
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
    .filter((filterName) => !registeredPlugins.has(filterName));
}

/**
 * 단일 필터를 적용한다.
 *
 * @param imageData 원본 이미지 데이터
 * @param filterOptions 적용할 필터 옵션
 * @returns 필터가 적용된 이미지 데이터
 * @throws {ImageProcessError} 필터가 등록되지 않았거나 파라미터 검증에 실패하면
 */
export function applyFilter(imageData: ImageData, filterOptions: FilterOptions): ImageData {
  const plugin = registeredPlugins.get(filterOptions.name);
  if (!plugin) {
    throw createFilterNotFoundError(filterOptions.name);
  }

  // 비활성 필터는 원본 사본을 그대로 돌려준다.
  if (filterOptions.enabled === false) {
    return copyImageData(imageData);
  }

  const validation = plugin.validate(filterOptions.params);
  if (!validation.valid) {
    throw createInvalidFilterParamsError(validation.errors);
  }

  let result = plugin.apply(imageData, filterOptions.params);

  // 블렌딩과 불투명도를 순서대로 합성한다.
  if (filterOptions.blend !== undefined && filterOptions.blend !== BlendMode.NORMAL) {
    result = applyBlendMode(imageData, result, filterOptions.blend);
  }

  if (filterOptions.opacity !== undefined && filterOptions.opacity < 1) {
    result = applyOpacity(imageData, result, filterOptions.opacity);
  }

  return result;
}

/**
 * 필터 체인을 순차 적용한다.
 *
 * @param imageData 원본 이미지 데이터
 * @param filterChain 적용할 필터 체인
 * @returns 모든 필터가 적용된 이미지 데이터
 */
export function applyFilterChain(imageData: ImageData, filterChain: FilterChain): ImageData {
  // 원본을 보존하기 위해 사본에서 시작한다.
  let result = copyImageData(imageData);

  const enabledFilters = filterChain.filters.filter((filter) => filter.enabled !== false);

  for (const filterOption of enabledFilters) {
    result = applyFilter(result, filterOption);
  }

  return result;
}

/**
 * 필터 체인 전체의 파라미터를 검증한다.
 *
 * @param filterChain 검증할 필터 체인
 * @returns 체인 전체의 검증 결과
 */
export function validateFilterChain(filterChain: FilterChain): FilterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < filterChain.filters.length; i++) {
    const filter = filterChain.filters[i];
    const plugin = registeredPlugins.get(filter.name);

    if (!plugin) {
      errors.push(`Filter '${filter.name}' not found (index: ${i})`);
      continue;
    }

    const validation = plugin.validate(filter.params);
    if (!validation.valid) {
      errors.push(`Filter '${filter.name}' parameter error (index: ${i}): ${validation.errors?.join(', ')}`);
    }

    if (filter.blend !== undefined && !supportedBlendModes.has(filter.blend)) {
      errors.push(`Filter '${filter.name}' blend mode error (index: ${i}): '${filter.blend}' is not supported`);
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
 * 레지스트리를 비운다.
 *
 * @internal 테스트 격리 전용. 공개 배럴에 등재하지 않는다.
 */
export function resetFilterRegistryForTesting(): void {
  registeredPlugins.clear();
}

/** ImageData를 깊은 사본으로 복제한다. */
function copyImageData(imageData: ImageData): ImageData {
  const copiedData = new Uint8ClampedArray(imageData.data.length);
  copiedData.set(imageData.data);
  return new ImageData(copiedData, imageData.width, imageData.height);
}
