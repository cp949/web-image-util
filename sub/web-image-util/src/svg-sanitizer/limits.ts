/**
 * strict SVG sanitizer의 입력 크기/노드 한도 검증 헬퍼.
 *
 * 두 함수 모두 fail-fast로 ImageProcessError를 던지며, 라이브러리 외부에서는 직접 호출할
 * 수 없다(서브패스 export 대상이 아님).
 */

import { ImageProcessError } from '../errors';

/**
 * 입력 SVG의 UTF-8 바이트 크기가 maxBytes를 초과하면 ImageProcessError를 던진다.
 *
 * @param svg 입력 SVG 문자열
 * @param maxBytes 최대 허용 바이트
 */
export function assertWithinMaxBytes(svg: string, maxBytes: number): void {
  // TextEncoder는 브라우저와 happy-dom 모두에서 사용 가능
  const byteLength = new TextEncoder().encode(svg).byteLength;
  if (byteLength > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    throw new ImageProcessError(
      `SVG input size (${byteLength} bytes) exceeds the maximum allowed (${maxBytes} bytes, ~${limitMb}MiB)`,
      'SVG_BYTES_EXCEEDED',
      { details: { actualBytes: byteLength, maxBytes } }
    );
  }
}

/**
 * 사용자 제한 옵션이 DoS 방어를 비활성화하지 않도록 검증한다.
 *
 * @param name 옵션 이름
 * @param value 옵션 값
 * @param minimum 최소 허용값
 */
export function assertSafeIntegerLimit(name: string, value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new ImageProcessError(`Option "${name}" must be a safe integer >= ${minimum}`, 'OPTION_INVALID', {
      details: { option: name, minimum },
    });
  }
}
