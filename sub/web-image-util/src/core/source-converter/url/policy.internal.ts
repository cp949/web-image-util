/**
 * URL/프로토콜 검증 정책 헬퍼다.
 *
 * 이 모듈은 fetch를 수행하지 않는다. 입력 문자열의 형태와 정책 비교만 다룬다.
 */

import { ImageProcessError } from '../../../types';

/**
 * 입력 문자열이 명시적 스킴을 가진 절대 URL인지 판정한다.
 *
 * 상대 경로(`./image.png`, `/assets/logo.png`)는 false를 반환해
 * 브라우저의 동일 출처 자산 로딩 경로를 유지한다.
 *
 * @param input 검사할 문자열
 * @returns 명시적 URL 스킴이 있으면 true
 */
export function hasExplicitUrlScheme(input: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(input.trim());
}

/**
 * 입력 문자열이 protocol-relative URL(`//cdn.example.com/image.png`)인지 판정한다.
 *
 * @param input 검사할 문자열
 * @returns protocol-relative URL이면 true
 */
export function isProtocolRelativeUrl(input: string): boolean {
  return input.trim().startsWith('//');
}

/**
 * fetch 실패가 사용자 취소 또는 타임아웃에 의한 중단인지 판정한다.
 *
 * @param error fetch에서 발생한 예외
 * @returns 중단 계열 오류면 true
 */
export function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorName = 'name' in error && typeof error.name === 'string' ? error.name : '';
  if (errorName === 'AbortError' || errorName === 'TimeoutError') {
    return true;
  }

  if (error instanceof ImageProcessError && error.cause instanceof Error) {
    return isAbortLikeError(error.cause);
  }

  return false;
}

/**
 * 정책 검사용 URL 문자열을 절대 URL로 정규화한다.
 *
 * protocol-relative URL은 현재 문서 위치를 기준으로 절대 URL로 바꾼다.
 *
 * @param input 원본 URL 문자열
 * @returns 정책 검사에 사용할 절대 URL 문자열
 */
export function normalizePolicyUrl(input: string): string {
  if (!isProtocolRelativeUrl(input)) {
    return input;
  }

  const fallbackBase = 'http://localhost';
  const baseHref =
    typeof globalThis.location?.href === 'string' && globalThis.location.href.length > 0
      ? globalThis.location.href
      : fallbackBase;

  return new URL(input, baseHref).toString();
}

/**
 * URL 프로토콜이 허용 목록에 있는지 확인하고, 없으면 INVALID_SOURCE 오류를 던진다.
 *
 * @param url 검사할 URL 문자열
 * @param allowedProtocols 허용할 프로토콜 목록 (예: ['http:', 'https:', 'blob:'])
 */
export function checkAllowedProtocol(url: string, allowedProtocols: string[]): void {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch (error) {
    // URL 파싱에 실패하면 잘못된 소스로 간주한다. 진단을 위해 파싱 오류를 cause로 보존한다.
    throw new ImageProcessError(`Invalid URL format: ${url}`, 'INVALID_SOURCE', { cause: error, details: { url } });
  }

  if (!allowedProtocols.includes(protocol)) {
    throw new ImageProcessError(`Protocol not allowed: ${protocol}`, 'INVALID_SOURCE', { details: { url } });
  }
}
