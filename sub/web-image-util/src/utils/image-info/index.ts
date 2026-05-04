/**
 * 이미지 정보 조회 API의 진입점.
 *
 * 책임은 다음 4개 서브모듈로 나뉜다.
 * - {@link ./types}            공개 타입 정의
 * - {@link ./format-detection} 입력 소스 기반 포맷 감지
 * - {@link ./dimensions}       치수/비율/방향 추출
 * - {@link ./remote-fetch}     원격 URL fetch + SSRF 가드
 *
 * 본 파일은 두 모듈을 결합한 종합 정보 함수 `getImageInfo`만 추가로 정의하고,
 * 외부 호환을 위한 모든 export를 한 곳에서 모은다.
 */

import type { ImageSource } from '../../types';
import { getImageDimensions } from './dimensions';
import { getImageFormat } from './format-detection';
import type { ImageInfo } from './types';

export { getImageAspectRatio, getImageDimensions, getImageOrientation } from './dimensions';

export { getImageFormat } from './format-detection';
export { fetchImageFormat, fetchImageSourceBlob } from './remote-fetch';
export type {
  FetchImageFormatOptions,
  FetchImageSourceBlobOptions,
  FetchImageSourceBlobResult,
  ImageDimensions,
  ImageInfo,
  ImageOrientation,
} from './types';

/**
 * 이미지 소스의 치수와 입력 포맷을 반환한다.
 *
 * @description 포맷은 MIME, Data URL 헤더, 경로 확장자, 바이너리 시그니처 순으로 필요한 만큼만
 * 확인한다. 치수 확인은 `getImageDimensions()`와 같은 fast path를 공유해 이미지 로딩을 중복하지 않는다.
 */
export async function getImageInfo(source: ImageSource): Promise<ImageInfo> {
  const format = await getImageFormat(source);
  const dimensions = await getImageDimensions(source);

  return {
    ...dimensions,
    format,
  };
}
