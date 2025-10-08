/**
 * Processor state type definitions
 *
 * @description Track resize() call state at TypeScript type level to
 * detect incorrect usage at compile time.
 */

/**
 * Brand type representing processor state
 */
export interface ProcessorState {
  readonly __brand: 'ProcessorState';
}

/**
 * State before resize() call
 * In this state, resize() method can be called.
 */
export interface BeforeResize extends ProcessorState {
  readonly __resizeState: 'before';
}

/**
 * State after resize() call
 * In this state, resize() method cannot be called again.
 */
export interface AfterResize extends ProcessorState {
  readonly __resizeState: 'after';
}

/**
 * State type utilities
 */
export type ProcessorStateType = BeforeResize | AfterResize;

/**
 * Type guard: Check if resize() can be called
 */
export type CanResize<T extends ProcessorState> = T extends BeforeResize ? true : false;

/**
 * Conditional type: State transition after resize() call
 */
export type AfterResizeCall<T extends ProcessorState> = T extends BeforeResize ? AfterResize : never;

/**
 * Compile-time error message type
 */
export type ResizeAlreadyCalledError = {
  error: 'resize() method can only be called once. Specify final size directly.';
  solution: 'Correct usage: .resize({ fit: "cover", width: 300, height: 200 })';
  avoid: 'Incorrect usage: .resize(...).resize(...)';
};

/**
 * Type-level constraint check
 */
export type EnsureCanResize<T extends ProcessorState> = CanResize<T> extends true ? void : ResizeAlreadyCalledError;
