/**
 * Type-safe image processor interface
 *
 * @description Tracks resize() call state with TypeScript type system to
 * prevent incorrect usage at compile time.
 */

import type { BlurOptions, ResultBlob, ResultCanvas, ResultDataURL, ResultFile } from '../types';
import type { AfterResize, AfterResizeCall, BeforeResize, EnsureCanResize, ProcessorState } from './processor-state';
import type { ResizeConfig } from './resize-config';
import type { IShortcutBuilder } from './processor-interface';

// Re-export for use by other modules
export type { AfterResize, BeforeResize } from './processor-state';

/**
 * Type-safe image processor interface
 *
 * @template TState Current processor state (BeforeResize | AfterResize)
 */
export interface TypedImageProcessor<TState extends ProcessorState = BeforeResize> {
  /**
   * Shortcut API accessor
   *
   * @description Provides Sharp.js style convenient resizing methods.
   * Supports autocomplete and type checking through type-safe interface.
   */
  shortcut: IShortcutBuilder<TState>;

  /**
   * Image resizing (can only be called once)
   *
   * @description The resize() method can only be called once.
   * Multiple calls will result in compile error.
   *
   * @param config Resizing configuration
   * @returns Processor instance in state after resize() call
   *
   * @example
   * ```typescript
   * const processor = processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 });
   * ```
   */
  resize(
    config: ResizeConfig,
    // Type-level constraint: only available when resize() can be called
    _constraint?: EnsureCanResize<TState>
  ): TypedImageProcessor<AfterResizeCall<TState>>;

  /**
   * Apply blur effect
   *
   * @description Can be used regardless of whether resize() has been called.
   * @param radius Blur radius (default: 2)
   * @param options Blur options (optional)
   * @returns Processor instance with same state
   */
  blur(radius?: number, options?: Partial<BlurOptions>): TypedImageProcessor<TState>;

  /**
   * Return result as Blob
   */
  toBlob(options?: any): Promise<ResultBlob>;
  toBlob(format?: string): Promise<ResultBlob>;

  /**
   * Return result as Canvas
   */
  toCanvas(): Promise<ResultCanvas>;

  /**
   * Return result as Data URL
   */
  toDataURL(options?: any): Promise<ResultDataURL>;
  toDataURL(format?: string): Promise<ResultDataURL>;

  /**
   * Return result as File
   */
  toFile(filename?: string, options?: any): Promise<ResultFile>;
  toFile(filename?: string, format?: string): Promise<ResultFile>;
}

/**
 * Initial processor type (before resize() call)
 */
export type InitialProcessor = TypedImageProcessor<BeforeResize>;

/**
 * Resizing complete processor type (after resize() call)
 */
export type ResizedProcessor = TypedImageProcessor<AfterResize>;

/**
 * Processor factory function type
 */
export type ProcessorFactory = (source: any) => InitialProcessor;

/**
 * Type utility: Check current state
 */
export type GetProcessorState<T> = T extends TypedImageProcessor<infer S> ? S : never;

/**
 * Type utility: Whether resize() can be called
 */
export type CanCallResize<T> = T extends TypedImageProcessor<BeforeResize> ? true : false;
