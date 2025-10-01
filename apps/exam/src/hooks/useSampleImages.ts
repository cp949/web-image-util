import { useCallback } from 'react';

/**
 * 샘플 이미지 정보 타입
 */
export interface SampleImage {
  /** 이미지 이름 */
  name: string;
  /** 이미지 경로 */
  path: string;
  /** 이미지 타입 */
  type: 'jpg' | 'png' | 'svg';
  /** 이미지 크기 카테고리 */
  size: 'small' | 'medium' | 'large';
  /** 설명 */
  description: string;
  /** 미리보기 경로 */
  preview: string;
}

/**
 * 샘플 이미지 목록
 */
const SAMPLE_IMAGES: SampleImage[] = [
  // Sample 1 - 고화질 사진
  {
    name: 'Sample 1 - 고화질 사진',
    path: '/sample-images/sample1.jpg',
    type: 'jpg',
    size: 'large',
    description: '고화질 풍경 사진 (JPEG, ~800KB)',
    preview: '/sample-images/sample1.jpg',
  },
  {
    name: 'Sample 1 - 투명 그래픽',
    path: '/sample-images/sample1.png',
    type: 'png',
    size: 'medium',
    description: '투명도 포함 그래픽 (PNG, ~220KB)',
    preview: '/sample-images/sample1.png',
  },
  {
    name: 'Sample 1 - 간단한 벡터',
    path: '/sample-images/sample1.svg',
    type: 'svg',
    size: 'small',
    description: '간단한 벡터 이미지 (SVG, ~5KB)',
    preview: '/sample-images/sample1.svg',
  },
  // Sample 2 - 대용량 이미지
  {
    name: 'Sample 2 - 대용량 사진',
    path: '/sample-images/sample2.jpg',
    type: 'jpg',
    size: 'large',
    description: '대용량 고해상도 사진 (JPEG, ~2MB)',
    preview: '/sample-images/sample2.jpg',
  },
  {
    name: 'Sample 2 - 작은 그래픽',
    path: '/sample-images/sample2.png',
    type: 'png',
    size: 'small',
    description: '작은 그래픽 이미지 (PNG, ~4KB)',
    preview: '/sample-images/sample2.png',
  },
  {
    name: 'Sample 2 - 중간 벡터',
    path: '/sample-images/sample2.svg',
    type: 'svg',
    size: 'medium',
    description: '중간 복잡도 벡터 (SVG, ~23KB)',
    preview: '/sample-images/sample2.svg',
  },
  // Sample 3 - 작은 이미지
  {
    name: 'Sample 3 - 작은 사진',
    path: '/sample-images/sample3.jpg',
    type: 'jpg',
    size: 'small',
    description: '작은 사진 (JPEG, ~9KB)',
    preview: '/sample-images/sample3.jpg',
  },
  {
    name: 'Sample 3 - 작은 PNG',
    path: '/sample-images/sample3.png',
    type: 'png',
    size: 'small',
    description: '작은 PNG 이미지 (~11KB)',
    preview: '/sample-images/sample3.png',
  },
  {
    name: 'Sample 3 - 복잡한 벡터',
    path: '/sample-images/sample3.svg',
    type: 'svg',
    size: 'large',
    description: '복잡한 벡터 이미지 (SVG, ~155KB)',
    preview: '/sample-images/sample3.svg',
  },
  // Sample 4 - 중간 크기 이미지
  {
    name: 'Sample 4 - 중간 사진',
    path: '/sample-images/sample4.jpg',
    type: 'jpg',
    size: 'medium',
    description: '중간 크기 사진 (JPEG, ~34KB)',
    preview: '/sample-images/sample4.jpg',
  },
  {
    name: 'Sample 4 - 중간 PNG',
    path: '/sample-images/sample4.png',
    type: 'png',
    size: 'medium',
    description: '중간 PNG 이미지 (~24KB)',
    preview: '/sample-images/sample4.png',
  },
  {
    name: 'Sample 4 - 초대형 벡터',
    path: '/sample-images/sample4.svg',
    type: 'svg',
    size: 'large',
    description: '초대형 복잡 벡터 (SVG, ~305KB)',
    preview: '/sample-images/sample4.svg',
  },
];

/**
 * 샘플 이미지 관리 훅
 */
export function useSampleImages() {
  /**
   * 타입별 이미지 필터링
   */
  const getImagesByType = useCallback((type: 'jpg' | 'png' | 'svg') => {
    return SAMPLE_IMAGES.filter((img) => img.type === type);
  }, []);

  /**
   * 크기별 이미지 필터링
   */
  const getImagesBySize = useCallback((size: 'small' | 'medium' | 'large') => {
    return SAMPLE_IMAGES.filter((img) => img.size === size);
  }, []);

  /**
   * 추천 이미지 가져오기 - Phase 3: 확장된 추천 시스템
   */
  const getRecommendedImages = useCallback((demoType: string): SampleImage[] => {
    const recommendations: Record<string, { images: string[]; reason: string }> = {
      // 기본 데모들
      basic: {
        images: ['sample1.jpg', 'sample2.png', 'sample3.jpg'],
        reason: '다양한 크기와 포맷으로 기본 기능 테스트에 최적',
      },
      padding: {
        images: ['sample1.jpg', 'sample2.png', 'sample1.svg'],
        reason: '패딩 효과가 명확히 보이는 이미지들',
      },
      'quick-preview': {
        images: ['sample3.jpg', 'sample4.jpg', 'sample2.png'],
        reason: '빠른 미리보기에 적합한 중간 크기 이미지',
      },

      // 고급 기능
      presets: {
        images: ['sample1.jpg', 'sample3.png', 'sample4.jpg'],
        reason: '프리셋 기능 시연에 적합한 다양한 이미지',
      },
      advanced: {
        images: ['sample4.svg', 'sample2.png', 'sample3.svg'],
        reason: '고급 처리 기능 테스트에 적합',
      },
      filters: {
        images: ['sample1.jpg', 'sample2.jpg', 'sample4.jpg'],
        reason: '필터 효과가 잘 보이는 고화질 사진',
      },

      // SVG 관련
      svg: {
        images: ['sample1.svg', 'sample2.svg', 'sample3.svg', 'sample4.svg'],
        reason: 'SVG 처리 및 호환성 테스트용',
      },
      'svg-quality': {
        images: ['sample3.svg', 'sample4.svg', 'sample2.svg'],
        reason: 'SVG 품질 테스트를 위한 복잡한 벡터 이미지',
      },

      // 성능 및 배치
      batch: {
        images: ['sample1.jpg', 'sample2.png', 'sample3.svg', 'sample4.jpg'],
        reason: '배치 처리를 위한 다양한 포맷 혼합',
      },
      performance: {
        images: ['sample2.jpg', 'sample1.jpg', 'sample4.jpg'],
        reason: '성능 측정을 위한 대용량 이미지',
      },
      'performance-benchmark': {
        images: ['sample2.jpg', 'sample4.svg'],
        reason: '벤치마크 테스트용 고해상도 이미지',
      },

      // 변환 및 포맷
      converters: {
        images: ['sample1.jpg', 'sample2.png', 'sample1.svg'],
        reason: '다양한 포맷 변환 테스트용',
      },
      'smart-format': {
        images: ['sample1.jpg', 'sample2.jpg', 'sample3.jpg'],
        reason: '스마트 포맷 선택 테스트용 JPEG 이미지',
      },
      'image-source-converter': {
        images: ['sample1.jpg', 'sample2.png', 'sample3.svg'],
        reason: '소스 타입 변환 테스트용',
      },

      // 비교 및 갤러리
      'fit-mode-comparison': {
        images: ['sample1.jpg', 'sample2.png'],
        reason: 'Fit 모드 비교를 위한 일반적인 비율 이미지',
      },
      'preview-gallery': {
        images: ['sample1.jpg', 'sample2.png', 'sample3.jpg', 'sample4.jpg'],
        reason: '갤러리 미리보기용 다양한 이미지',
      },

      // 개발자 도구
      'dev-tools': {
        images: ['sample1.jpg', 'sample2.png', 'sample3.svg'],
        reason: '개발 도구용',
      },
    };

    const recommendation = recommendations[demoType];
    if (!recommendation) return [];

    return SAMPLE_IMAGES.filter((img) =>
      recommendation.images.some((name) => img.path.includes(name)),
    );
  }, []);

  return {
    /** 전체 샘플 이미지 목록 */
    sampleImages: SAMPLE_IMAGES,
    /** 타입별 필터링 */
    getImagesByType,
    /** 크기별 필터링 */
    getImagesBySize,
    /** 추천 이미지 가져오기 */
    getRecommendedImages,
  };
}