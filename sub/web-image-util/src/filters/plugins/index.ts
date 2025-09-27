/**
 * 필터 플러그인 export
 *
 * 이 파일은 모든 필터 플러그인들을 등록하고 내보내는 중앙 집중식 관리 파일입니다.
 */

import { filterManager, registerFilter } from '../plugin-system';
import { BlurFilterPlugins } from './blur-plugins';
import { ColorFilterPlugins } from './color-plugins';
import { EffectFilterPlugins } from './effect-plugins';

/**
 * 모든 기본 필터 플러그인들
 *
 * @description 색상, 효과, 블러 카테고리의 모든 기본 필터 플러그인들을 포함하는 배열
 * 라이브러리 초기화 시 자동으로 등록됩니다.
 */
export const AllFilterPlugins = [...ColorFilterPlugins, ...EffectFilterPlugins, ...BlurFilterPlugins];

/**
 * 모든 기본 필터 플러그인들을 자동으로 등록
 *
 * @description 라이브러리 초기화 시 한 번 호출되어 모든 기본 필터를 filterManager에 등록합니다.
 * 등록 성공/실패 통계를 콘솔에 출력합니다.
 */
export function registerDefaultFilters(): void {
  console.debug('기본 필터 플러그인들을 등록 중...');

  let registeredCount = 0;
  let failedCount = 0;

  for (const plugin of AllFilterPlugins) {
    try {
      registerFilter(plugin);
      registeredCount++;
    } catch (error) {
      console.error(`필터 플러그인 '${plugin.name}' 등록 실패:`, error);
      failedCount++;
    }
  }

  console.debug(`필터 플러그인 등록 완료: ${registeredCount}개 성공, ${failedCount}개 실패`);

  // 시스템 정보 출력 (개발 모드에서만)
  if (process.env.NODE_ENV === 'development') {
    const systemInfo = filterManager.getSystemInfo();
    console.debug('필터 시스템 정보:', systemInfo);
  }
}

/**
 * 플러그인 시스템 초기화
 *
 * @description 라이브러리가 로드될 때 자동으로 호출되어 필터 시스템을 초기화합니다.
 * 기본 필터들을 등록하고 전역 객체에 필터 API를 노출합니다.
 */
export function initializeFilterSystem(): void {
  // 기본 필터들 등록
  registerDefaultFilters();

  // 개발자가 추가 플러그인을 등록할 수 있도록 전역 객체에 등록 함수 노출
  if (typeof window !== 'undefined') {
    // 브라우저 환경
    (window as any).WebImageUtil = {
      ...((window as any).WebImageUtil || {}),
      filters: {
        register: registerFilter,
        manager: filterManager,
      },
    };
  } else if (typeof global !== 'undefined') {
    // Node.js 환경
    (global as any).WebImageUtil = {
      ...((global as any).WebImageUtil || {}),
      filters: {
        register: registerFilter,
        manager: filterManager,
      },
    };
  }
}

// 라이브러리 로드 시 자동 초기화
initializeFilterSystem();

// 편의를 위해 개별 플러그인 카테고리들도 내보냄
export { BlurFilterPlugins } from './blur-plugins';
export { ColorFilterPlugins } from './color-plugins';
export { EffectFilterPlugins } from './effect-plugins';

// 플러그인 시스템의 핵심 요소들 재내보내기
export { applyFilter, applyFilterChain, filterManager, getAvailableFilters, registerFilter } from '../plugin-system';
export type {
  BlendMode,
  FilterCategory,
  FilterChain,
  FilterOptions,
  FilterPlugin,
  FilterValidationResult,
} from '../plugin-system';
