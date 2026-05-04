/**
 * Data URL 처리 중 발생하는 오류 메시지 상수와 throw 헬퍼.
 *
 * 외부에는 메시지 문자열을 직접 노출하지 않으며, 다른 서브모듈이 일관된
 * 오류를 던질 수 있도록 진입점 역할만 한다.
 */

export const INVALID_DATA_URL_MESSAGE = '유효한 Data URL이 아닙니다';
export const INVALID_SVG_DATA_URL_MESSAGE = '유효한 SVG Data URL이 아닙니다';

export function throwInvalidDataURL(): never {
  throw new Error(INVALID_DATA_URL_MESSAGE);
}

export function throwInvalidSvgDataURL(cause?: unknown): never {
  // 원본 오류를 cause에 보존해 호출자가 정확한 원인(예: malformed Data URL vs. non-SVG MIME)을 추적할 수 있게 한다.
  // ES2020 lib에는 ErrorOptions가 없어 런타임에서 속성을 직접 부여한다.
  const error = new Error(INVALID_SVG_DATA_URL_MESSAGE);
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  throw error;
}
