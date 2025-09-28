/**
 * 새로운 플러그인 기반 필터 시스템
 *
 * 주요 특징:
 * - 플러그인 등록 및 동적 로딩 지원
 * - 타입 안전성 강화
 * - 필터 체인 최적화
 * - 커스텀 필터 지원
 */

/**
 * 기본 필터 플러그인 인터페이스
 *
 * @description 모든 필터 플러그인이 구현해야 하는 인터페이스
 * 타입 안전성과 일관된 API를 보장합니다.
 * @template TParams 필터 매개변수 타입
 */
export interface FilterPlugin<TParams = any> {
  /** 고유한 필터 이름 */
  readonly name: string;

  /** 필터 설명 */
  readonly description?: string;

  /** 필터 카테고리 */
  readonly category: FilterCategory;

  /** 기본 매개변수 */
  readonly defaultParams: TParams;

  /**
   * 필터 적용 함수
   * @param imageData - 원본 이미지 데이터
   * @param params - 필터 매개변수
   * @returns 필터가 적용된 이미지 데이터
   */
  apply(imageData: ImageData, params: TParams): ImageData;

  /**
   * 매개변수 유효성 검사
   * @param params - 검사할 매개변수
   * @returns 유효성 검사 결과
   */
  validate(params: TParams): FilterValidationResult;

  /**
   * 필터 미리보기 (선택적)
   * 작은 샘플 이미지로 빠른 미리보기 생성
   */
  preview?(imageData: ImageData, params: TParams): ImageData;

  /**
   * 필터 최적화 가능 여부
   * 다른 필터와 결합하여 최적화할 수 있는지 확인
   */
  canOptimizeWith?(otherFilter: FilterPlugin): boolean;
}

/**
 * 필터 카테고리
 *
 * @description 필터를 기능별로 분류하는 카테고리 enum
 * 필터 매니저에서 카테고리별 관리에 사용됩니다.
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
 * 필터 유효성 검사 결과
 */
export interface FilterValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * 필터 적용 옵션
 */
export interface FilterOptions<TParams = any> {
  name: string;
  params: TParams;
  blend?: BlendMode;
  opacity?: number; // 0 ~ 1
  enabled?: boolean; // 필터 활성화 상태
  id?: string; // 체인에서 필터 식별용
}

/**
 * 블렌드 모드 (확장)
 *
 * @description 필터 적용 시 원본 이미지와 합성하는 방식을 정의하는 enum
 * CSS blend-mode와 유사한 효과를 제공합니다.
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
 * 필터 체인
 */
export interface FilterChain {
  filters: FilterOptions[];
  preview?: boolean;
  optimize?: boolean; // 체인 최적화 여부
  name?: string; // 체인 이름 (프리셋용)
}

/**
 * 필터 플러그인 매니저
 *
 * @description 필터 플러그인의 등록, 관리, 적용을 담당하는 중앙 관리 클래스
 * 싱글톤 패턴으로 구현되어 전역에서 일관된 필터 관리를 제공합니다.
 */
export class FilterPluginManager {
  private static instance: FilterPluginManager;
  private plugins = new Map<string, FilterPlugin>();
  private categories = new Map<FilterCategory, Set<string>>();

  private constructor() {}

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): FilterPluginManager {
    if (!FilterPluginManager.instance) {
      FilterPluginManager.instance = new FilterPluginManager();
    }
    return FilterPluginManager.instance;
  }

  /**
   * 필터 플러그인 등록
   * @param plugin - 등록할 플러그인
   */
  register<TParams>(plugin: FilterPlugin<TParams>): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`필터 '${plugin.name}'가 이미 등록되어 있습니다. 새 필터로 덮어씁니다.`);
    }

    this.plugins.set(plugin.name, plugin);

    // 카테고리별 분류
    if (!this.categories.has(plugin.category)) {
      this.categories.set(plugin.category, new Set());
    }
    this.categories.get(plugin.category)!.add(plugin.name);

    console.debug(`필터 플러그인 '${plugin.name}' 등록 완료`);
  }

  /**
   * 플러그인 등록 해제
   * @param name - 해제할 플러그인 이름
   */
  unregister(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    this.plugins.delete(name);
    this.categories.get(plugin.category)?.delete(name);

    console.debug(`필터 플러그인 '${name}' 등록 해제 완료`);
    return true;
  }

  /**
   * 등록된 플러그인 반환
   * @param name - 플러그인 이름
   */
  getPlugin(name: string): FilterPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 모든 등록된 플러그인 반환
   */
  getAllPlugins(): FilterPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 카테고리별 플러그인 반환
   * @param category - 필터 카테고리
   */
  getPluginsByCategory(category: FilterCategory): FilterPlugin[] {
    const names = this.categories.get(category) || new Set();
    return Array.from(names)
      .map((name) => this.plugins.get(name)!)
      .filter(Boolean);
  }

  /**
   * 사용 가능한 모든 필터 이름 반환
   */
  getAvailableFilters(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * 필터가 등록되어 있는지 확인
   * @param name - 확인할 필터 이름
   */
  hasFilter(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * 단일 필터 적용
   * @param imageData - 원본 이미지 데이터
   * @param filterOptions - 필터 옵션
   * @returns 필터가 적용된 이미지 데이터
   */
  applyFilter(imageData: ImageData, filterOptions: FilterOptions): ImageData {
    const plugin = this.plugins.get(filterOptions.name);
    if (!plugin) {
      throw new Error(`필터 '${filterOptions.name}'를 찾을 수 없습니다.`);
    }

    // 필터가 비활성화된 경우 원본 반환
    if (filterOptions.enabled === false) {
      const copiedData = new Uint8ClampedArray(imageData.data.length);
      copiedData.set(imageData.data);
      return new ImageData(copiedData, imageData.width, imageData.height);
    }

    // 매개변수 유효성 검사
    const validation = plugin.validate(filterOptions.params);
    if (!validation.valid) {
      throw new Error(`필터 매개변수가 유효하지 않습니다: ${validation.errors?.join(', ')}`);
    }

    // 필터 적용
    let result = plugin.apply(imageData, filterOptions.params);

    // 블렌딩 및 투명도 적용
    if (filterOptions.blend && filterOptions.blend !== BlendMode.NORMAL) {
      result = this.applyBlendMode(imageData, result, filterOptions.blend);
    }

    if (filterOptions.opacity !== undefined && filterOptions.opacity < 1) {
      result = this.applyOpacity(imageData, result, filterOptions.opacity);
    }

    return result;
  }

  /**
   * 필터 체인 적용
   * @param imageData - 원본 이미지 데이터
   * @param filterChain - 적용할 필터 체인
   * @returns 모든 필터가 적용된 이미지 데이터
   */
  applyFilterChain(imageData: ImageData, filterChain: FilterChain): ImageData {
    // ImageData 복사 생성
    const copiedData = new Uint8ClampedArray(imageData.data.length);
    copiedData.set(imageData.data);
    let result = new ImageData(copiedData, imageData.width, imageData.height);

    // 최적화 옵션이 활성화된 경우
    const filters = filterChain.optimize ? this.optimizeFilterChain(filterChain.filters) : filterChain.filters;

    // 활성화된 필터만 적용
    const enabledFilters = filters.filter((filter) => filter.enabled !== false);

    for (const filterOption of enabledFilters) {
      result = this.applyFilter(result, filterOption);
    }

    return result;
  }

  /**
   * 필터 체인 최적화
   * 동일한 카테고리의 필터들을 결합하거나 불필요한 필터를 제거
   * @param filters - 최적화할 필터 배열
   * @returns 최적화된 필터 배열
   */
  private optimizeFilterChain(filters: FilterOptions[]): FilterOptions[] {
    const optimized: FilterOptions[] = [];
    const colorFilters: FilterOptions[] = [];

    for (const filter of filters) {
      const plugin = this.plugins.get(filter.name);
      if (!plugin) continue;

      // 색상 필터들은 별도로 수집하여 결합 가능성 확인
      if (plugin.category === FilterCategory.COLOR) {
        colorFilters.push(filter);
      } else {
        // 색상 필터가 쌓여있다면 먼저 처리
        if (colorFilters.length > 0) {
          optimized.push(...this.mergeColorFilters(colorFilters));
          colorFilters.length = 0;
        }
        optimized.push(filter);
      }
    }

    // 남은 색상 필터들 처리
    if (colorFilters.length > 0) {
      optimized.push(...this.mergeColorFilters(colorFilters));
    }

    return optimized;
  }

  /**
   * 색상 필터들 병합
   * @param colorFilters - 병합할 색상 필터들
   * @returns 병합된 필터 배열
   */
  private mergeColorFilters(colorFilters: FilterOptions[]): FilterOptions[] {
    // 현재는 단순한 구현, 실제로는 더 복잡한 병합 로직이 필요
    return colorFilters;
  }

  /**
   * 블렌드 모드 적용
   * @param original - 원본 이미지 데이터
   * @param filtered - 필터된 이미지 데이터
   * @param blendMode - 블렌드 모드
   * @returns 블렌딩된 이미지 데이터
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
        // 다른 블렌드 모드들도 여기에 추가
      }

      result[i] = Math.round(rResult * 255);
      result[i + 1] = Math.round(gResult * 255);
      result[i + 2] = Math.round(bResult * 255);
      result[i + 3] = origData[i + 3]; // 알파 유지
    }

    return new ImageData(result, original.width, original.height);
  }

  /**
   * 투명도 적용
   * @param original - 원본 이미지 데이터
   * @param filtered - 필터된 이미지 데이터
   * @param opacity - 투명도 (0 ~ 1)
   * @returns 투명도가 적용된 이미지 데이터
   */
  private applyOpacity(original: ImageData, filtered: ImageData, opacity: number): ImageData {
    const result = new Uint8ClampedArray(original.data.length);
    const origData = original.data;
    const filtData = filtered.data;

    for (let i = 0; i < origData.length; i += 4) {
      // 선형 보간
      result[i] = origData[i] + opacity * (filtData[i] - origData[i]);
      result[i + 1] = origData[i + 1] + opacity * (filtData[i + 1] - origData[i + 1]);
      result[i + 2] = origData[i + 2] + opacity * (filtData[i + 2] - origData[i + 2]);
      result[i + 3] = origData[i + 3]; // 알파 유지
    }

    return new ImageData(result, original.width, original.height);
  }

  /**
   * 필터 체인 유효성 검사
   * @param filterChain - 검사할 필터 체인
   * @returns 체인 전체의 유효성 검사 결과
   */
  validateFilterChain(filterChain: FilterChain): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < filterChain.filters.length; i++) {
      const filter = filterChain.filters[i];
      const plugin = this.plugins.get(filter.name);

      if (!plugin) {
        errors.push(`필터 '${filter.name}'를 찾을 수 없습니다 (인덱스: ${i})`);
        continue;
      }

      const validation = plugin.validate(filter.params);
      if (!validation.valid) {
        errors.push(`필터 '${filter.name}' 매개변수 오류 (인덱스: ${i}): ${validation.errors?.join(', ')}`);
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
   * 플러그인 시스템 정보 반환
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
   * 테스트용 인스턴스 리셋
   * @internal 테스트 전용 메서드 - 프로덕션 코드에서 사용하지 마세요
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
 * 전역 필터 매니저 인스턴스
 *
 * @description 라이브러리 전체에서 사용되는 필터 매니저의 싱글톤 인스턴스
 * 모든 필터 플러그인 관리 작업은 이 인스턴스를 통해 수행됩니다.
 */
export const filterManager = FilterPluginManager.getInstance();

/**
 * 편의 함수들
 */
/**
 * 필터 플러그인 등록
 *
 * @description 새로운 필터 플러그인을 전역 필터 매니저에 등록합니다.
 * @param plugin 등록할 필터 플러그인
 */
export function registerFilter(plugin: FilterPlugin<any>): void {
  filterManager.register(plugin);
}

/**
 * 단일 필터 적용
 *
 * @description 하나의 필터를 이미지 데이터에 적용합니다.
 * @param imageData 원본 이미지 데이터
 * @param filterOptions 적용할 필터 옵션
 * @returns 필터가 적용된 이미지 데이터
 */
export function applyFilter(imageData: ImageData, filterOptions: FilterOptions): ImageData {
  return filterManager.applyFilter(imageData, filterOptions);
}

/**
 * 필터 체인 적용
 *
 * @description 여러 필터를 순차적으로 적용합니다.
 * @param imageData 원본 이미지 데이터
 * @param filterChain 적용할 필터 체인
 * @returns 모든 필터가 적용된 이미지 데이터
 */
export function applyFilterChain(imageData: ImageData, filterChain: FilterChain): ImageData {
  return filterManager.applyFilterChain(imageData, filterChain);
}

/**
 * 사용 가능한 필터 목록 조회
 *
 * @description 현재 등록된 모든 필터의 이름 목록을 반환합니다.
 * @returns 등록된 필터 이름 배열
 */
export function getAvailableFilters(): string[] {
  return filterManager.getAvailableFilters();
}
