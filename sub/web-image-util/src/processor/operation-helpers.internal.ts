/**
 * resize/blur 연산 추가 시 공통으로 쓰는 가드와 옵션 생성 헬퍼다.
 *
 * @description ImageProcessor의 resize 1회 제약 검사와 blur 옵션 조립 로직을 분리한다.
 * 에러 메시지와 코드는 기존 동작을 그대로 유지한다.
 */

import type { BlurOptions } from '../types';
import { ImageProcessError } from '../types';

/** `resize()` 중복 호출 시 사용하는 에러 메시지다. */
export const MULTIPLE_RESIZE_RESIZE_MESSAGE =
  'resize() can only be called once. Use a single resize() call to prevent image quality degradation.';

/** Shortcut API의 resize operation 중복 추가 시 사용하는 에러 메시지다. */
export const MULTIPLE_RESIZE_OPERATION_MESSAGE =
  'resize() can only be called once. Use a single resize operation to prevent image quality degradation.';

/**
 * resize가 이미 호출되었으면 ImageProcessError를 던진다.
 *
 * @param hasResized 현재까지 resize 호출 여부
 * @param message 호출 경로별 에러 메시지
 */
export function assertResizeNotCalled(hasResized: boolean, message: string): void {
  if (hasResized) {
    throw new ImageProcessError(message, 'MULTIPLE_RESIZE_NOT_ALLOWED');
  }
}

/**
 * blur 반경과 추가 옵션을 합쳐 BlurOptions를 만든다.
 *
 * @param radius blur 반경(px)
 * @param options 추가 blur 옵션
 */
export function buildBlurOptions(radius: number, options: Partial<BlurOptions>): BlurOptions {
  return {
    radius,
    ...options,
  };
}
