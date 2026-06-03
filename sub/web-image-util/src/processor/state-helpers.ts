/**
 * ImageProcessor의 resize/blur 상태 변경 규칙을 담당하는 helper다.
 *
 * @description 지연 렌더링과 resize 1회 제약을 보존하기 위해, 상태 전이 로직을
 * 순수 함수로 분리한다. 호출부(processor.ts)가 자신의 private 필드를 인자로 넘기고
 * 반환값을 다시 필드에 반영하는 형태로 사용한다. 새 public export는 만들지 않는다.
 */

import type { BlurOptions } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import { validateResizeConfig } from '../types/resize-config';
import { assertResizeNotCalled, buildBlurOptions } from './operation-helpers';

/**
 * `resize()`의 상태 변경 결과다.
 *
 * @description 호출부가 이 값을 자신의 필드에 반영한다.
 */
export interface ResizeStateUpdate {
  hasResized: boolean;
  pendingResizeConfig: ResizeConfig;
}

/**
 * `resize()` 호출 시의 검증과 상태 전이를 수행한다.
 *
 * @description resize 1회 제약 검사와 config 런타임 검증을 거친 뒤, 갱신할
 * 상태 값을 반환한다. 실제 필드 반영과 반환 타입 캐스팅은 호출부가 처리한다.
 *
 * @param hasResized 현재까지 resize 호출 여부
 * @param config resize 설정
 * @param multipleResizeMessage resize 중복 호출 시 사용할 에러 메시지
 */
export function applyResizeState(
  hasResized: boolean,
  config: ResizeConfig,
  multipleResizeMessage: string
): ResizeStateUpdate {
  // 1. resize 중복 호출 방지 (품질 저하 방지)
  assertResizeNotCalled(hasResized, multipleResizeMessage);

  // 2. 런타임 검증
  validateResizeConfig(config);

  // 3. resize 호출 기록 및 pending 저장
  // LazyRenderPipeline은 이후 ensureLazyPipeline()에서 초기화되므로 config만 보관한다.
  return {
    hasResized: true,
    pendingResizeConfig: config,
  };
}

/**
 * `blur()` 호출 시 누적할 blur 옵션 배열을 만든다.
 *
 * @description blur는 여러 번 호출 가능하므로 기존 배열에 새 옵션을 append한 결과를
 * 반환한다. 순서는 호출 순서대로 보존한다.
 *
 * @param pendingBlurOptions 현재까지 누적된 blur 옵션 배열
 * @param radius blur 반경(px)
 * @param options 추가 blur 옵션
 */
export function appendBlurState(
  pendingBlurOptions: BlurOptions[],
  radius: number,
  options: Partial<BlurOptions>
): BlurOptions[] {
  const blurOptions = buildBlurOptions(radius, options);

  // blur는 여러 번 호출될 수 있어 pending 배열로 관리한다.
  // 입력 배열을 mutate하지 않고 새 배열을 반환한다(호출 순서는 그대로 보존).
  return [...pendingBlurOptions, blurOptions];
}

/**
 * `_addResizeOperation()`의 pending/즉시 적용 분기 결정이다.
 */
export type ResizeOperationPlan = { mode: 'apply' | 'pending' };

/**
 * Shortcut API의 resize operation 추가 시 상태 전이와 적용 방식을 결정한다.
 *
 * @description resize 1회 제약을 검사하고, LazyRenderPipeline 초기화 여부에 따라
 * 즉시 적용(`apply`)할지 pending에 저장(`pending`)할지를 반환한다. 실제 부수효과
 * (lazyPipeline._addResizeOperation 호출 또는 pendingResizeOperation 저장)와
 * hasResized 갱신은 호출부가 수행한다.
 *
 * @param hasResized 현재까지 resize 호출 여부
 * @param hasLazyPipeline LazyRenderPipeline 초기화 여부
 * @param multipleResizeMessage resize 중복 호출 시 사용할 에러 메시지
 */
export function planResizeOperation(
  hasResized: boolean,
  hasLazyPipeline: boolean,
  multipleResizeMessage: string
): ResizeOperationPlan {
  assertResizeNotCalled(hasResized, multipleResizeMessage);

  // LazyRenderPipeline 초기화 전: pending 저장 (ensureLazyPipeline()에서 자동 반영)
  // 초기화 후: 즉시 전달
  return hasLazyPipeline ? { mode: 'apply' } : { mode: 'pending' };
}
