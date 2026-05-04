/**
 * SVG 호환성 보강 옵션과 리포트 타입, 기본 옵션 상수를 정의한다.
 */

/**
 * SVG 호환성 보강 동작을 제어하는 옵션 모음이다.
 *
 * @description 원본 의미를 유지하면서 브라우저별 렌더링 차이를 줄이는 데 필요한
 * 정책 토글, 폴백 크기, BBox 계산 전략을 한곳에 모은다.
 */
export interface SvgCompatibilityOptions {
  /** 크기 단서가 없을 때 사용할 기본 viewBox 폭/높이 */
  defaultSize?: { width: number; height: number };

  /** 누락된 xmlns/xmlns:xlink 자동 보강 여부 */
  addNamespaces?: boolean;

  /** width/height/viewBox 등 좌표계 보정 수행 여부 */
  fixDimensions?: boolean;

  /** xlink:href를 href로 현대화할지 여부 */
  modernizeSyntax?: boolean;

  /** preserveAspectRatio 기본값 주입 여부 */
  addPreserveAspectRatio?: boolean;

  /** true면 가능한 width/height 주입을 피하고 반응형 렌더링을 유지 */
  preferResponsive?: boolean;

  /**
   * viewBox 정책
   * - preserve-framing: 좌표계 원점(0,0)을 유지하고 폭/높이만 추정
   * - fit-content: 실제 콘텐츠 bbox에 맞춰 viewBox를 다시 계산
   */
  mode?: 'preserve-framing' | 'fit-content';

  /** fit-content 모드에서 콘텐츠 주위에 추가할 여백 비율(0.02 = 2%) */
  paddingPercent?: number;

  /**
   * 브라우저 환경에서 실제 SVGGraphicsElement.getBBox()로 BBox를 계산할지 여부
   * - DOM에 임시 노드를 부착해 측정하므로 SSR/Node에서는 자동 비활성화된다
   */
  enableLiveBBox?: boolean;

  /**
   * rect/circle/ellipse/line/poly* 속성만으로 BBox를 근사 계산할지 여부
   * - getBBox 사용이 어려울 때 빠른 폴백으로 사용된다
   * - path/text 등은 무시되므로 paddingPercent로 안전 마진을 둘 수 있다
   */
  enableHeuristicBBox?: boolean;

  /**
   * 0×0 렌더링 방지 및 콘텐츠 기반 크기 산출을 강제할지 여부
   * - 모드별 기본값: preserve-framing은 false, fit-content는 true
   * - true면 viewBox W/H를 width/height로 주입하거나 콘텐츠 BBox 산출을 시도한다
   */
  ensureNonZeroViewport?: boolean;
}

/**
 * SVG 호환성 보강 결과 리포트다.
 *
 * @description 어떤 보정이 적용됐는지와 디버깅에 도움이 되는 메타 정보를 담는다.
 */
export interface SvgCompatibilityReport {
  /** 자동 추가된 네임스페이스 목록(svg, xlink 등) */
  addedNamespaces: string[];

  /** width/height/viewBox 보정이 수행됐는지 여부 */
  fixedDimensions: boolean;

  /** xlink:href → href로 변환된 노드 개수 */
  modernizedSyntax: number;

  /** 처리 중 감지된 경고 메시지 목록 */
  warnings: string[];

  /** 디버깅용 보조 정보 메시지 목록 */
  infos?: string[];

  /** 전체 처리 시간(ms) */
  processingTimeMs: number;
}

/** 모든 필드가 채워진 기본 옵션 상수다. 사용자 옵션 머지 시 베이스로 쓴다. */
export const DEFAULT_OPTIONS: Required<Omit<SvgCompatibilityOptions, 'defaultSize' | 'paddingPercent'>> & {
  defaultSize: { width: number; height: number };
  paddingPercent: number;
} = {
  defaultSize: { width: 512, height: 512 },
  addNamespaces: true,
  fixDimensions: true,
  modernizeSyntax: true,
  addPreserveAspectRatio: true,
  preferResponsive: true,
  mode: 'preserve-framing',
  paddingPercent: 0.0,
  enableLiveBBox: false,
  enableHeuristicBBox: true,
  ensureNonZeroViewport: true,
};
