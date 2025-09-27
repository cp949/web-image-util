/**
 * 프리셋 함수들 - 자주 사용되는 이미지 처리 패턴들
 *
 * @description 사용자가 자주 필요로 하는 이미지 처리를 간단한 함수 호출로 제공
 * 내부적으로 최적화된 옵션을 사용하여 최고의 결과를 보장함
 */

import { processImage } from '../processor';
import type { ImageSource, ResultBlob } from '../types';

/**
 * 썸네일 생성 옵션
 */
export interface ThumbnailOptions {
  /** 크기 (정사각형) 또는 너비/높이 객체 */
  size: number | { width: number; height?: number };
  /** 출력 포맷 (기본: WebP 지원시 webp, 아니면 jpeg) */
  format?: 'webp' | 'jpeg' | 'png';
  /** 압축 품질 0.0-1.0 (기본: 0.8) */
  quality?: number;
  /** 리사이징 모드 (기본: 'cover') */
  fit?: 'cover' | 'contain';
  /** 배경색 (fit 모드에서, 기본: 흰색) */
  background?: string;
}

/**
 * 썸네일 생성기
 *
 * @description 웹에서 가장 자주 사용되는 썸네일 생성을 위한 최적화된 프리셋
 * 자동으로 최적의 포맷과 품질을 선택하여 파일 크기와 품질의 균형을 맞춤
 *
 * @param source 이미지 소스
 * @param options 썸네일 옵션
 * @returns 생성된 썸네일 Blob과 메타데이터
 *
 * @example
 * ```typescript
 * // 기본 사용법 - 300px 정사각형 썸네일
 * const result = await createThumbnail(imageSource, { size: 300 });
 *
 * // 직사각형 썸네일
 * const result = await createThumbnail(imageSource, {
 *   size: { width: 400, height: 300 }
 * });
 *
 * // 고품질 PNG 썸네일
 * const result = await createThumbnail(imageSource, {
 *   size: 150,
 *   format: 'png',
 *   quality: 0.9
 * });
 *
 * // 전체 이미지 보존 (여백 포함)
 * const result = await createThumbnail(imageSource, {
 *   size: 200,
 *   fit: 'contain',
 *   background: '#f0f0f0'
 * });
 * ```
 */
export async function createThumbnail(source: ImageSource, options: ThumbnailOptions): Promise<ResultBlob> {
  // 크기 정규화
  const { width, height } =
    typeof options.size === 'number'
      ? { width: options.size, height: options.size }
      : { width: options.size.width, height: options.size.height || options.size.width };

  // 기본 옵션 설정
  const defaultOptions = {
    format: (await getOptimalFormat('webp', 'jpeg')) as 'webp' | 'jpeg' | 'png',
    quality: 0.8,
    fit: 'cover' as const,
    background: '#ffffff',
  };

  const finalOptions = { ...defaultOptions, ...options };

  // 이미지 프로세싱
  return await processImage(source)
    .resize(width, height, {
      fit: finalOptions.fit,
      background: finalOptions.background,
    })
    .toBlob({
      format: finalOptions.format,
      quality: finalOptions.quality,
    });
}

/**
 * 아바타 생성 옵션
 */
export interface AvatarOptions {
  /** 아바타 크기 (정사각형, 기본: 64) */
  size?: number;
  /** 배경색 (기본: 투명) */
  background?: string;
  /** 출력 포맷 (기본: png - 투명도 지원) */
  format?: 'webp' | 'png';
  /** 압축 품질 0.0-1.0 (기본: 0.9 - 고품질) */
  quality?: number;
}

/**
 * 아바타 생성기
 *
 * @description 사용자 프로필용 정사각형 아바타 이미지를 생성하는 프리셋
 * 정사각형 아바타를 생성하며, 배경색 옵션을 제공
 *
 * @param source 이미지 소스
 * @param options 아바타 옵션
 * @returns 생성된 아바타 Blob과 메타데이터
 *
 * @example
 * ```typescript
 * // 기본 64px 정사각형 아바타
 * const result = await createAvatar(imageSource);
 *
 * // 128px 아바타
 * const result = await createAvatar(imageSource, {
 *   size: 128
 * });
 *
 * // 배경색이 있는 아바타
 * const result = await createAvatar(imageSource, {
 *   size: 80,
 *   background: '#f8f9fa'
 * });
 * ```
 */
export async function createAvatar(source: ImageSource, options: AvatarOptions = {}): Promise<ResultBlob> {
  // 기본 옵션
  const defaultOptions = {
    size: 64,
    circle: false,
    background: 'transparent',
    format: 'png' as const, // 투명도 지원
    quality: 0.9, // 아바타는 고품질로
  };

  const finalOptions = { ...defaultOptions, ...options };

  // 기본 리사이징 (정사각형, cover fit)
  const processor = processImage(source).resize(finalOptions.size, finalOptions.size, {
    fit: 'cover',
    position: 'center',
    background: finalOptions.background,
  });

  return await processor.toBlob({
    format: finalOptions.format,
    quality: finalOptions.quality,
  });
}

/**
 * 소셜 이미지 플랫폼 타입
 */
export type SocialPlatform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'pinterest';

/**
 * 소셜 이미지 생성 옵션
 */
export interface SocialImageOptions {
  /** 플랫폼 (권장 크기 자동 적용) */
  platform: SocialPlatform;
  /** 커스텀 크기 (플랫폼 설정을 오버라이드) */
  customSize?: { width: number; height: number };
  /** 배경색 (기본: 흰색) */
  background?: string;
  /** 출력 포맷 (기본: jpeg - 소셜 플랫폼 최적화) */
  format?: 'jpeg' | 'png' | 'webp';
  /** 압축 품질 0.0-1.0 (기본: 0.85) */
  quality?: number;
}

/**
 * 플랫폼별 권장 이미지 크기 (2024년 기준)
 */
const SOCIAL_PLATFORM_SIZES: Record<SocialPlatform, { width: number; height: number }> = {
  // 트위터(X) - 1200x675 (16:9 비율)
  twitter: { width: 1200, height: 675 },

  // 페이스북 - 1200x630 (1.91:1 비율)
  facebook: { width: 1200, height: 630 },

  // 인스타그램 - 1080x1080 (1:1 비율, 정사각형)
  instagram: { width: 1080, height: 1080 },

  // 링크드인 - 1200x627 (1.91:1 비율)
  linkedin: { width: 1200, height: 627 },

  // 유튜브 썸네일 - 1280x720 (16:9 비율)
  youtube: { width: 1280, height: 720 },

  // 핀터레스트 - 1000x1500 (2:3 비율, 세로형)
  pinterest: { width: 1000, height: 1500 },
};

/**
 * 소셜 이미지 생성기
 *
 * @description 소셜 미디어 플랫폼별 최적화된 이미지를 생성하는 프리셋
 * 각 플랫폼의 권장 크기와 비율을 자동으로 적용하며, SEO에 최적화됨
 *
 * @param source 이미지 소스
 * @param options 소셜 이미지 옵션
 * @returns 생성된 소셜 이미지 Blob과 메타데이터
 *
 * @example
 * ```typescript
 * // 트위터용 이미지 (1200x675)
 * const result = await createSocialImage(imageSource, {
 *   platform: 'twitter'
 * });
 *
 * // 인스타그램용 정사각형 이미지 (1080x1080)
 * const result = await createSocialImage(imageSource, {
 *   platform: 'instagram'
 * });
 *
 * // 배경색을 적용한 페이스북용 이미지
 * const result = await createSocialImage(imageSource, {
 *   platform: 'facebook',
 *   background: '#f8f9fa'
 * });
 *
 * // 커스텀 크기 (플랫폼 설정 오버라이드)
 * const result = await createSocialImage(imageSource, {
 *   platform: 'twitter',
 *   customSize: { width: 800, height: 600 }
 * });
 * ```
 */
export async function createSocialImage(source: ImageSource, options: SocialImageOptions): Promise<ResultBlob> {
  // 크기 결정
  const targetSize = options.customSize || SOCIAL_PLATFORM_SIZES[options.platform];

  // 기본 옵션
  const defaultOptions = {
    background: '#ffffff',
    format: 'jpeg' as const, // 소셜 플랫폼에 최적화
    quality: 0.85,
  };

  const finalOptions = { ...defaultOptions, ...options };

  return await processImage(source)
    .resize(targetSize.width, targetSize.height, {
      fit: 'contain', // 소셜 이미지는 보통 전체 이미지가 보이도록 함
      position: 'center',
      background: finalOptions.background,
    })
    .toBlob({
      format: finalOptions.format,
      quality: finalOptions.quality,
    });
}

/**
 * 최적 포맷 선택 유틸리티
 *
 * @description 브라우저 지원 여부를 확인하여 최적의 이미지 포맷을 선택
 * @param preferredFormat 선호 포맷
 * @param fallbackFormat 대체 포맷
 * @returns 지원되는 포맷
 */
async function getOptimalFormat(preferredFormat: string, fallbackFormat: string): Promise<string> {
  // Canvas.toBlob으로 포맷 지원 여부 확인
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(preferredFormat);
      } else {
        resolve(fallbackFormat);
      }
    }, `image/${preferredFormat}`);
  });
}
