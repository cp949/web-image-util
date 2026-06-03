/**
 * 인코딩 출력(toDataURL/toFile) 보조 헬퍼다.
 *
 * @description Blob → Data URL 변환과 toFile의 포맷/파일명 해석 로직을 분리한다.
 * 메타데이터 래핑(Result* 생성)은 호출 측 클래스에 남긴다.
 */

import type { OutputFormat, OutputOptions } from '../types';
import { applyFormatExtensionToFilename, getFormatFromFilename, getOptimalQuality } from './format-helpers';

/**
 * Blob을 Data URL 문자열로 변환한다.
 */
export async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert to Data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * toFile 입력으로부터 최종 출력 옵션과 정규화된 파일명을 계산한다.
 *
 * - 문자열 인자는 포맷 지정으로 본다.
 * - 빈 옵션 객체이고 파일명에서 포맷을 추출할 수 있으면 그 포맷과 권장 품질을 쓴다.
 * - 그 외에는 전달된 옵션을 그대로 쓴다.
 * - 포맷이 정해지면 파일명 확장자도 그에 맞춰 정규화한다.
 *
 * @param filename 사용자 지정 파일명
 * @param optionsOrFormat OutputOptions 또는 OutputFormat 문자열
 * @param defaultQuality 품질 fallback 값
 */
export function resolveFileOutput(
  filename: string,
  optionsOrFormat: OutputOptions | OutputFormat,
  defaultQuality?: number
): { finalOptions: OutputOptions; resolvedFilename: string } {
  // 파일 확장자로부터 포맷을 자동 감지한다.
  const formatFromFilename = getFormatFromFilename(filename);

  let finalOptions: OutputOptions;
  if (typeof optionsOrFormat === 'string') {
    // 문자열 포맷 지정
    finalOptions = { format: optionsOrFormat };
  } else if (Object.keys(optionsOrFormat).length === 0 && formatFromFilename) {
    // 빈 객체이고 파일명에서 포맷을 알아낼 수 있는 경우
    finalOptions = {
      format: formatFromFilename,
      quality: getOptimalQuality(formatFromFilename, defaultQuality),
    };
  } else {
    // 전달된 옵션을 그대로 사용
    finalOptions = optionsOrFormat;
  }

  // 명시된 포맷이 있으면 파일명 확장자도 그에 맞춰 정규화한다.
  const resolvedFilename = finalOptions.format
    ? applyFormatExtensionToFilename(filename, finalOptions.format)
    : filename;

  return { finalOptions, resolvedFilename };
}
