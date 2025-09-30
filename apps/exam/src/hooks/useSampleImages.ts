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
   * 추천 이미지 가져오기
   */
  const getRecommendedImages = useCallback((demoType: string): SampleImage[] => {
    const recommendations: Record<string, string[]> = {
      basic: ['sample1.jpg', 'sample2.png'],
      presets: ['sample1.jpg', 'sample3.png', 'sample4.jpg'],
      advanced: ['sample4.svg', 'sample2.png', 'sample3.svg'],
      filters: ['sample1.jpg', 'sample2.jpg'],
      svg: ['sample1.svg', 'sample2.svg', 'sample3.svg', 'sample4.svg'],
      batch: ['sample1.jpg', 'sample2.png', 'sample3.svg', 'sample4.jpg'],
      performance: ['sample1.jpg', 'sample2.jpg'],
      'svg-quality': ['sample3.svg', 'sample4.svg'],
      'smart-format': ['sample1.jpg', 'sample2.jpg'],
    };

    const recommendedNames = recommendations[demoType] || [];
    return SAMPLE_IMAGES.filter((img) =>
      recommendedNames.some((name) => img.path.includes(name)),
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