/**
 * 출력 옵션 정규화 헬퍼다.
 *
 * @description string | OutputOptions 형태의 인자를 Required<OutputOptions>로 변환한다.
 * toBlob을 포함한 모든 출력 경로에서 사용한다.
 * getBestFormat/getOptimalQuality 의존성은 콜백으로 주입받아 클래스 결합을 피한다.
 */

import type { ImageFormat, OutputFormat, OutputOptions } from '../types';

/**
 * resolveOutputOptions 입력 인터페이스
 */
export interface ResolveOutputOptionsInput {
  optionsOrFormat: OutputOptions | OutputFormat;
  getBestFormat: () => OutputFormat;
  getOptimalQuality: (format: ImageFormat) => number;
}

/**
 * toBlob 인자를 Required<OutputOptions>로 정규화한다.
 *
 * - 문자열 포맷 → {format, quality: getOptimalQuality(format)}
 * - smartFormat을 기본 포맷으로, fallbackFormat은 'png'로 고정
 * - 사용자가 format만 지정하고 quality를 생략하면 format에 맞는 최적 quality를 설정한다.
 */
export function resolveOutputOptions(input: ResolveOutputOptionsInput): Required<OutputOptions> {
  const { optionsOrFormat, getBestFormat, getOptimalQuality } = input;

  // 문자열이면 포맷 지정으로 보고 최적 품질을 설정한다.
  const options: OutputOptions =
    typeof optionsOrFormat === 'string'
      ? {
          format: optionsOrFormat,
          quality: getOptimalQuality(optionsOrFormat),
        }
      : optionsOrFormat;

  // Smart 기본 포맷 선택: WebP 지원 시 WebP, 아니면 PNG
  const smartFormat = getBestFormat();

  const outputOptions: Required<OutputOptions> = {
    format: smartFormat,
    quality: getOptimalQuality(smartFormat),
    fallbackFormat: 'png',
    ...options,
  };

  // quality: 0은 유효한 값이므로 falsy 체크 대신 === undefined로 생략 여부를 판별한다.
  // 사용자가 format은 지정했으나 quality를 생략한 경우 format 최적 품질을 적용한다.
  if (options.format && options.quality === undefined) {
    outputOptions.quality = getOptimalQuality(options.format);
  }

  return outputOptions;
}
