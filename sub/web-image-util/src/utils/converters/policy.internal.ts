/**
 * 입력 재사용/재인코딩 정책 헬퍼.
 *
 * @description ensure* 변환에서 원본 Blob/File을 그대로 통과시킬 수 있는지,
 * 어떤 출력 옵션으로 재인코딩해야 하는지를 결정하는 순수 함수 모음.
 */

import type { OutputOptions } from '../../types';
import { formatToMimeType, getOutputFilename, mimeTypeToOutputFormat } from '../format-utils';
import type { EnsureFileOptions } from './types';

/**
 * File 인스턴스인지 안전하게 판정한다.
 */
export function isFileSource(source: unknown): source is File {
  return typeof File !== 'undefined' && source instanceof File;
}

/**
 * Blob 재인코딩이 필요한지 판정한다.
 */
export function shouldReencodeBlob(blob: Blob, options: OutputOptions): boolean {
  if (options.quality !== undefined) {
    return true;
  }

  if (!options.format) {
    return false;
  }

  return blob.type !== `image/${options.format}` && blob.type !== formatToMimeType(options.format);
}

/**
 * Blob 재인코딩 시 명시 포맷이 없으면 원본 MIME을 출력 포맷으로 유지한다.
 */
export function getBlobReencodeOptions(blob: Blob, options: OutputOptions): OutputOptions {
  if (options.format) {
    return options;
  }

  const sourceFormat = mimeTypeToOutputFormat(blob.type);
  if (!sourceFormat) {
    return options;
  }

  return {
    ...options,
    format: sourceFormat,
  };
}

/**
 * File 원본을 그대로 재사용할 수 있는지 판정한다.
 */
export function shouldReuseFile(file: File, filename: string, options: EnsureFileOptions): boolean {
  return (
    file.name === filename && filename === getFinalFilename(filename, options) && !shouldReencodeBlob(file, options)
  );
}

/**
 * 출력 옵션을 반영한 최종 파일명을 계산한다.
 */
export function getFinalFilename(filename: string, options: EnsureFileOptions): string {
  return getOutputFilename(filename, options);
}
