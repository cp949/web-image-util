/**
 * web-image-util Resize Config 타입 시스템
 * Sharp 라이브러리의 API 패턴을 참고한 Discriminated Union 기반 타입 정의
 */

import { ImageProcessError } from './index';

// ============================================================================
// BASE TYPES - 기본 타입들
// ============================================================================

/**
 * 리사이즈 결과물에 적용할 padding 정의
 * - 숫자 하나면 4방향 동일
 * - 객체면 필요한 방향만 선택적으로 지정
 */
export type Padding =
  | number
  | {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };

/**
 * 모든 ResizeConfig에 공통으로 적용되는 기본 설정
 */
export interface BaseResizeConfig {
  /** 리사이즈 결과물 주변 패딩 (픽셀) */
  padding?: Padding;
  /** 배경색 (CSS 색상 문자열, 기본: 투명한 검정) */
  background?: string;
}

// ============================================================================
// FIT MODE CONFIGS - 각 fit 모드별 개별 설정
// ============================================================================

/**
 * Cover 모드: 이미지를 지정된 크기에 맞춰 꽉 채움 (일부 잘릴 수 있음)
 * CSS object-fit: cover와 동일한 동작
 */
export interface CoverConfig extends BaseResizeConfig {
  fit: 'cover';
  width: number;
  height: number;
}

/**
 * Contain 모드: 이미지를 지정된 크기 안에 전체가 들어가도록 맞춤 (여백 생김)
 * CSS object-fit: contain과 동일한 동작
 */
export interface ContainConfig extends BaseResizeConfig {
  fit: 'contain';
  width: number;
  height: number;
  /** 여백 제거 여부 (기본: false) - 배경색과 동일한 색상의 여백을 자동으로 제거 */
  trimEmpty?: boolean;
  /** 확대 방지 여부 (기본: false) - true면 작은 이미지를 확대하지 않음 */
  withoutEnlargement?: boolean;
}

/**
 * Fill 모드: 이미지를 지정된 크기에 정확히 맞춤 (비율 무시, 늘어나거나 압축됨)
 * CSS object-fit: fill과 동일한 동작
 */
export interface FillConfig extends BaseResizeConfig {
  fit: 'fill';
  width: number;
  height: number;
}

/**
 * MaxFit 모드: 최대 크기 제한 (축소만, 확대 안함)
 * - 이미지가 지정된 크기보다 크면 축소
 * - 이미지가 지정된 크기보다 작으면 원본 크기 유지
 * - width 또는 height 중 최소 하나는 필수
 */
export type MaxFitConfig =
  | (BaseResizeConfig & {
      fit: 'maxFit';
      width: number;
      height?: number;
    })
  | (BaseResizeConfig & {
      fit: 'maxFit';
      width?: number;
      height: number;
    })
  | (BaseResizeConfig & {
      fit: 'maxFit';
      width: number;
      height: number;
    });

/**
 * MinFit 모드: 최소 크기 보장 (확대만, 축소 안함)
 * - 이미지가 지정된 크기보다 작으면 확대
 * - 이미지가 지정된 크기보다 크면 원본 크기 유지
 * - width 또는 height 중 최소 하나는 필수
 */
export type MinFitConfig =
  | (BaseResizeConfig & {
      fit: 'minFit';
      width: number;
      height?: number;
    })
  | (BaseResizeConfig & {
      fit: 'minFit';
      width?: number;
      height: number;
    })
  | (BaseResizeConfig & {
      fit: 'minFit';
      width: number;
      height: number;
    });

// ============================================================================
// DISCRIMINATED UNION - 메인 타입 정의
// ============================================================================

/**
 * 새로운 ResizeConfig Discriminated Union 타입
 * - fit 필드로 타입 좁히기 가능
 * - 컴파일 타임 타입 안전성 보장
 */
export type ResizeConfig = CoverConfig | ContainConfig | FillConfig | MaxFitConfig | MinFitConfig;

// ============================================================================
// TYPE GUARDS - 타입 가드 함수들
// ============================================================================

/**
 * CoverConfig 타입 가드
 */
export function isCoverConfig(config: ResizeConfig): config is CoverConfig {
  return config.fit === 'cover';
}

/**
 * ContainConfig 타입 가드
 */
export function isContainConfig(config: ResizeConfig): config is ContainConfig {
  return config.fit === 'contain';
}

/**
 * FillConfig 타입 가드
 */
export function isFillConfig(config: ResizeConfig): config is FillConfig {
  return config.fit === 'fill';
}

/**
 * MaxFitConfig 타입 가드
 */
export function isMaxFitConfig(config: ResizeConfig): config is MaxFitConfig {
  return config.fit === 'maxFit';
}

/**
 * MinFitConfig 타입 가드
 */
export function isMinFitConfig(config: ResizeConfig): config is MinFitConfig {
  return config.fit === 'minFit';
}

// ============================================================================
// RUNTIME VALIDATION - 런타임 검증 함수
// ============================================================================

/**
 * ResizeConfig 런타임 검증 함수
 * - maxFit/minFit: width 또는 height 중 하나는 필수
 * - cover/contain/fill: width와 height 모두 필수
 * @throws {ImageProcessError} 유효하지 않은 설정일 경우
 */
export function validateResizeConfig(config: ResizeConfig): void {
  // maxFit과 minFit은 width나 height 중 하나는 필수
  if (config.fit === 'maxFit' || config.fit === 'minFit') {
    if (!config.width && !config.height) {
      throw new ImageProcessError(`${config.fit} requires at least width or height`, 'INVALID_DIMENSIONS');
    }
    // width 또는 height가 음수인지 확인
    if ((config.width && config.width <= 0) || (config.height && config.height <= 0)) {
      throw new ImageProcessError(`${config.fit} width and height must be positive numbers`, 'INVALID_DIMENSIONS');
    }
  }

  // cover, contain, fill은 width와 height 모두 필수
  if (config.fit === 'cover' || config.fit === 'contain' || config.fit === 'fill') {
    if (!config.width || !config.height) {
      throw new ImageProcessError(`${config.fit} requires both width and height`, 'INVALID_DIMENSIONS');
    }
    // width 또는 height가 음수인지 확인
    if (config.width <= 0 || config.height <= 0) {
      throw new ImageProcessError(`${config.fit} width and height must be positive numbers`, 'INVALID_DIMENSIONS');
    }
  }

  // padding 검증 (선택적)
  if (config.padding !== undefined) {
    if (typeof config.padding === 'number') {
      if (config.padding < 0) {
        throw new ImageProcessError('padding must be non-negative', 'INVALID_DIMENSIONS');
      }
    } else {
      // 객체 형태의 padding
      const { top = 0, right = 0, bottom = 0, left = 0 } = config.padding;
      if (top < 0 || right < 0 || bottom < 0 || left < 0) {
        throw new ImageProcessError('padding values must be non-negative', 'INVALID_DIMENSIONS');
      }
    }
  }
}
