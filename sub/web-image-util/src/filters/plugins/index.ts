/**
 * 기본 필터 플러그인 모음과 초기화 진입점을 한곳에서 노출하는 모듈이다.
 *
 * 새 기본 필터를 추가하면 해당 카테고리 모듈(blur/color/effect)의 export만 늘리면 자동으로 노출된다.
 */

import { debugLog, productionLog } from '../../utils/debug';
import type { FilterPlugin } from '../plugin-system';
import { filterManager, registerFilter } from '../plugin-system';
import { BlurFilterPlugins } from './blur-plugins';
import { ColorFilterPlugins } from './color-plugins';
import { EffectFilterPlugins } from './effect-plugins';

/**
 * 전체 기본 필터 플러그인 모음.
 *
 * color, effect, blur 카테고리의 모든 기본 필터를 포함하며 라이브러리 초기화 시 자동 등록된다.
 * 등록과 범용 직접 호출을 위해 파라미터 타입을 넓게 유지한다.
 * 플러그인별 정밀한 파라미터 타입이 필요하면 개별 플러그인 export를 사용한다.
 */
export const AllFilterPlugins: FilterPlugin<unknown>[] = [
  ...ColorFilterPlugins,
  ...EffectFilterPlugins,
  ...BlurFilterPlugins,
];

function hasAllDefaultFiltersRegistered(): boolean {
  return AllFilterPlugins.every((plugin) => filterManager.hasFilter(plugin.name));
}

/**
 * 모든 기본 필터 플러그인을 한 번에 등록한다.
 *
 * 라이브러리 초기화 시 한 번 호출되어 filterManager에 기본 필터를 모두 등록한다.
 * 등록 성공/실패 통계는 디버그 로그로 출력한다.
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

  // 개발 모드에서만 시스템 정보를 출력한다.
  if (process.env.NODE_ENV === 'development') {
    const systemInfo = filterManager.getSystemInfo();
    debugLog.debug('Filter system information:', systemInfo);
  }
}

/**
 * 플러그인 시스템을 초기화한다.
 *
 * 소비자가 필터 사용 전 명시적으로 호출해야 합니다. 기본 필터를 등록하고 필터 API를 전역 객체에 노출합니다.
 */
export function initializeFilterSystem(): void {
  if (!hasAllDefaultFiltersRegistered()) {
    registerDefaultFilters();
  }

  // 개발자가 추가 플러그인을 등록할 수 있도록 등록 함수를 전역 객체에 노출한다.
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

// 자동 초기화 제거됨 — 소비자가 명시적으로 initializeFilterSystem()을 호출해야 합니다.

// 카테고리별 플러그인 모듈을 그대로 노출한다.
// 새 기본 필터를 추가할 때 해당 카테고리 모듈에서 export만 추가하면 자동으로 함께 노출된다.
export * from './blur-plugins';
export * from './color-plugins';
export * from './effect-plugins';
