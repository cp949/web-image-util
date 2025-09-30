/**
 * 프로세서 상태 타입 정의
 *
 * @description resize() 호출 상태를 TypeScript 타입 레벨에서 추적하여
 * 컴파일 타임에 잘못된 사용법을 감지할 수 있습니다.
 */

/**
 * 프로세서 상태를 나타내는 브랜드 타입
 */
export interface ProcessorState {
  readonly __brand: 'ProcessorState';
}

/**
 * resize() 호출 전 상태
 * 이 상태에서는 resize() 메서드 호출이 가능합니다.
 */
export interface BeforeResize extends ProcessorState {
  readonly __resizeState: 'before';
}

/**
 * resize() 호출 후 상태
 * 이 상태에서는 resize() 메서드 재호출이 불가능합니다.
 */
export interface AfterResize extends ProcessorState {
  readonly __resizeState: 'after';
}

/**
 * 상태 타입 유틸리티
 */
export type ProcessorStateType = BeforeResize | AfterResize;

/**
 * 타입 가드: resize() 호출 가능 여부 확인
 */
export type CanResize<T extends ProcessorState> = T extends BeforeResize ? true : false;

/**
 * 조건부 타입: resize() 호출 후 상태 전환
 */
export type AfterResizeCall<T extends ProcessorState> = T extends BeforeResize ? AfterResize : never;

/**
 * 컴파일 타임 에러 메시지 타입
 */
export type ResizeAlreadyCalledError = {
  error: 'resize() 메서드는 한 번만 호출할 수 있습니다. 최종 크기를 직접 지정하세요.';
  solution: '올바른 사용법: .resize({ fit: "cover", width: 300, height: 200 })';
  avoid: '잘못된 사용법: .resize(...).resize(...)';
};

/**
 * 타입 레벨 제약 조건 검사
 */
export type EnsureCanResize<T extends ProcessorState> = CanResize<T> extends true
  ? void
  : ResizeAlreadyCalledError;