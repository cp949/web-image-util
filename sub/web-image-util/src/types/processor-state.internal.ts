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
 * Conditional type: State transition after resize() call
 */
export type AfterResizeCall<T extends ProcessorState> = T extends BeforeResize ? AfterResize : never;
