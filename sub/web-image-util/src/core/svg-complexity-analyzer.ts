/**
 * SVG 복잡도 분석 시스템
 *
 * @description
 * SVG의 구조와 내용을 분석하여 렌더링 복잡도를 계산하고
 * 최적의 품질 레벨을 자동으로 결정하는 지능형 분석 시스템
 *
 * **핵심 기능:**
 * - 다양한 SVG 요소별 복잡도 가중치 적용
 * - 파일 크기, 고급 기능 사용 여부 종합 분석
 * - 브라우저 렌더링 성능을 고려한 품질 레벨 추천
 * - 분석 실패 시 안전한 폴백 제공
 */

/**
 * SVG 복잡도 메트릭 인터페이스
 *
 * @description SVG 분석을 통해 수집되는 다양한 복잡도 지표들
 */
export interface SvgComplexityMetrics {
  /** path 요소 개수 - 벡터 경로의 복잡성 지표 */
  pathCount: number;
  /** 그라데이션 개수 - 색상 보간 계산 복잡도 */
  gradientCount: number;
  /** 필터 효과 개수 - 가장 높은 렌더링 비용 */
  filterCount: number;
  /** 애니메이션 요소 개수 - 동적 처리 복잡도 */
  animationCount: number;
  /** 텍스트 요소 개수 - 폰트 렌더링 복잡도 */
  textElementCount: number;
  /** 전체 요소 개수 - 전반적인 DOM 복잡도 */
  totalElementCount: number;
  /** 클리핑 패스 사용 여부 - 고급 마스킹 기능 */
  hasClipPath: boolean;
  /** 마스크 사용 여부 - 고급 투명도 처리 */
  hasMask: boolean;
  /** 파일 크기 (bytes) - 메모리 사용량 지표 */
  fileSize: number;
}

/**
 * 복잡도 분석 결과 인터페이스
 *
 * @description SVG 복잡도 분석의 최종 결과를 담는 종합 보고서
 */
export interface ComplexityAnalysisResult {
  /** 수집된 메트릭 정보 */
  metrics: SvgComplexityMetrics;
  /** 0.0 ~ 1.0 범위의 정규화된 복잡도 점수 */
  complexityScore: number;
  /** 분석 결과에 기반한 권장 품질 레벨 */
  recommendedQuality: QualityLevel;
  /** 추천 근거가 되는 구체적인 이유들 */
  reasoning: string[];
}

/**
 * SVG 렌더링 품질 레벨
 *
 * @description 복잡도에 따른 4단계 품질 레벨
 * - low: 단순한 SVG, 기본 렌더링
 * - medium: 보통 복잡도, 표준 품질
 * - high: 복잡한 SVG, 고품질 렌더링
 * - ultra: 매우 복잡하거나 대용량 SVG, 최고 품질
 */
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

/**
 * SVG 복잡도 분석 메인 함수
 *
 * @description
 * SVG 문자열을 파싱하여 복잡도를 종합적으로 분석하고
 * 최적의 렌더링 품질 레벨을 추천하는 핵심 함수
 *
 * **분석 과정:**
 * 1. XML 파싱 및 유효성 검증
 * 2. 다양한 복잡도 메트릭 수집
 * 3. 가중치 기반 복잡도 점수 계산
 * 4. 품질 레벨 결정 및 추천 근거 생성
 *
 * @param svgString 분석할 SVG XML 문자열
 * @returns 복잡도 분석 결과 (메트릭, 점수, 권장 품질, 근거)
 *
 * @example
 * ```typescript
 * const result = analyzeSvgComplexity('<svg>...</svg>');
 * console.log(`복잡도: ${result.complexityScore}`);
 * console.log(`권장 품질: ${result.recommendedQuality}`);
 * console.log(`근거: ${result.reasoning.join(', ')}`);
 * ```
 */
export function analyzeSvgComplexity(svgString: string): ComplexityAnalysisResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    // 파싱 에러 확인
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('SVG 파싱 실패');
    }

    // 메트릭 수집
    const metrics = collectMetrics(doc, svgString);

    // 복잡도 점수 계산 (0.0 ~ 1.0)
    const complexityScore = calculateComplexityScore(metrics);

    // 품질 레벨 결정
    const recommendedQuality = determineQualityLevel(complexityScore, metrics);

    // 추천 이유 생성
    const reasoning = generateRecommendationReasoning(metrics, complexityScore);

    return {
      metrics,
      complexityScore,
      recommendedQuality,
      reasoning,
    };
  } catch (error) {
    // 에러 발생 시 기본값 반환
    return createFallbackAnalysisResult(svgString, error instanceof Error ? error.message : '알 수 없는 오류');
  }
}

/**
 * SVG 문서에서 복잡도 메트릭을 수집
 *
 * @param doc 파싱된 SVG 문서
 * @param svgString 원본 SVG 문자열 (파일 크기 계산용)
 * @returns 수집된 메트릭
 */
function collectMetrics(doc: Document, svgString: string): SvgComplexityMetrics {
  return {
    pathCount: doc.querySelectorAll('path').length,
    gradientCount: doc.querySelectorAll('linearGradient, radialGradient').length,
    filterCount: doc.querySelectorAll('filter').length,
    animationCount: doc.querySelectorAll('animate, animateTransform, animateMotion').length,
    textElementCount: doc.querySelectorAll('text, tspan').length,
    totalElementCount: doc.querySelectorAll('*').length,
    hasClipPath: doc.querySelector('clipPath') !== null,
    hasMask: doc.querySelector('mask') !== null,
    fileSize: new Blob([svgString]).size,
  };
}

/**
 * 복잡도 점수 계산 알고리즘
 *
 * 각 요소에 가중치를 적용하여 전체 복잡도를 0.0~1.0 범위로 계산
 *
 * @param metrics 수집된 메트릭
 * @returns 복잡도 점수 (0.0 ~ 1.0)
 */
function calculateComplexityScore(metrics: SvgComplexityMetrics): number {
  let score = 0;

  // 경로 복잡도 (최대 0.3점)
  // 경로가 많을수록 렌더링이 복잡해짐
  score += Math.min(0.3, metrics.pathCount * 0.02);

  // 그라데이션 복잡도 (최대 0.2점)
  // 그라데이션은 픽셀 단위 계산이 필요해 복잡도 높음
  score += Math.min(0.2, metrics.gradientCount * 0.05);

  // 필터 복잡도 (최대 0.2점)
  // 필터 효과는 가장 계산 비용이 높음
  score += Math.min(0.2, metrics.filterCount * 0.1);

  // 애니메이션 복잡도 (최대 0.1점)
  // 애니메이션 요소는 정적 렌더링에서는 영향 적음
  score += Math.min(0.1, metrics.animationCount * 0.02);

  // 텍스트 복잡도 (최대 0.1점)
  // 텍스트 렌더링은 폰트에 따라 복잡도 다름
  score += Math.min(0.1, metrics.textElementCount * 0.02);

  // 고급 기능 복잡도 (최대 0.1점)
  if (metrics.hasClipPath) score += 0.05;
  if (metrics.hasMask) score += 0.05;

  return Math.min(1.0, score);
}

/**
 * 복잡도 점수와 메트릭을 기반으로 품질 레벨 결정
 *
 * @param complexityScore 복잡도 점수
 * @param metrics 메트릭 정보
 * @returns 권장 품질 레벨
 */
function determineQualityLevel(complexityScore: number, metrics: SvgComplexityMetrics): QualityLevel {
  // 파일 크기 고려 (50KB 이상은 대용량으로 간주)
  const isLargeFile = metrics.fileSize > 50000;

  // 고급 기능 사용 여부
  const hasAdvancedFeatures = metrics.hasClipPath || metrics.hasMask || metrics.filterCount > 0;

  // 복잡도와 특수 조건에 따른 품질 레벨 결정
  if (complexityScore >= 0.8 || isLargeFile || (hasAdvancedFeatures && complexityScore >= 0.6)) {
    return 'ultra';
  }

  if (complexityScore >= 0.6 || hasAdvancedFeatures) {
    return 'high';
  }

  if (complexityScore >= 0.3) {
    return 'medium';
  }

  return 'low';
}

/**
 * 추천 이유 텍스트 생성
 *
 * @param metrics 메트릭 정보
 * @param complexityScore 복잡도 점수
 * @returns 추천 이유 목록
 */
function generateRecommendationReasoning(metrics: SvgComplexityMetrics, complexityScore: number): string[] {
  const reasoning: string[] = [];

  // 전체 복잡도 평가
  if (complexityScore >= 0.8) {
    reasoning.push('전체 복잡도가 매우 높음 (고해상도 렌더링 필요)');
  } else if (complexityScore >= 0.6) {
    reasoning.push('전체 복잡도가 높음');
  } else if (complexityScore >= 0.3) {
    reasoning.push('중간 수준의 복잡도');
  } else {
    reasoning.push('단순한 구조');
  }

  // 구체적인 복잡도 요인들
  if (metrics.pathCount > 10) {
    reasoning.push(`다수의 경로 요소 (${metrics.pathCount}개)`);
  }

  if (metrics.gradientCount > 0) {
    reasoning.push(`그라데이션 효과 사용 (${metrics.gradientCount}개)`);
  }

  if (metrics.filterCount > 0) {
    reasoning.push(`필터 효과 사용 (${metrics.filterCount}개)`);
  }

  if (metrics.hasClipPath) {
    reasoning.push('클리핑 패스 사용');
  }

  if (metrics.hasMask) {
    reasoning.push('마스크 사용');
  }

  if (metrics.fileSize > 50000) {
    reasoning.push(`대용량 파일 (${Math.round(metrics.fileSize / 1024)}KB)`);
  }

  if (metrics.animationCount > 0) {
    reasoning.push(`애니메이션 요소 포함 (${metrics.animationCount}개)`);
  }

  return reasoning;
}

/**
 * 분석 실패 시 폴백 결과 생성
 *
 * @param svgString 원본 SVG 문자열
 * @param errorMessage 에러 메시지
 * @returns 기본 분석 결과
 */
function createFallbackAnalysisResult(svgString: string, errorMessage: string): ComplexityAnalysisResult {
  const fileSize = new Blob([svgString]).size;

  return {
    metrics: {
      pathCount: 0,
      gradientCount: 0,
      filterCount: 0,
      animationCount: 0,
      textElementCount: 0,
      totalElementCount: 0,
      hasClipPath: false,
      hasMask: false,
      fileSize,
    },
    complexityScore: 0.5, // 중간 복잡도로 가정
    recommendedQuality: fileSize > 50000 ? 'high' : 'medium', // 파일 크기 기반 결정
    reasoning: [
      '분석 실패로 기본값 사용',
      `오류: ${errorMessage}`,
      fileSize > 50000 ? '파일 크기 기반 high 품질 추천' : '중간 품질 추천',
    ],
  };
}
