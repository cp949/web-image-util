/**
 * Processor interface separation
 *
 * @description Defines the core interface for ImageProcessor.
 * ShortcutBuilder depends on this interface to prevent circular dependencies.
 * (shortcut 메서드 표면은 ShortcutBuilder 클래스가 직접 공개 타입을 겸한다 —
 * 별도 미러 인터페이스를 두지 않는다. 아래 ShortcutBuilder import는 type 전용이라
 * 런타임 순환이 없다.)
 */

import type { ShortcutBuilder } from '../shortcut/shortcut-builder';
import type { OutputFormat } from './base';
import type { BlurOptions, OutputOptions, ResultBlob, ResultCanvas, ResultDataURL, ResultFile } from './output-types';
import type { AfterResize, BeforeResize, ProcessorState } from './processor-state.internal';
import type { ResizeConfig } from './resize-config';

/**
 * Image processor interface
 *
 * @description Core interface implemented by the ImageProcessor class.
 * ShortcutBuilder depends on this interface to prevent circular dependencies.
 *
 * @template TState Processor state (BeforeResize | AfterResize)
 */
export interface IImageProcessor<TState extends ProcessorState = BeforeResize> {
  /**
   * Shortcut API accessor
   *
   * @description Provides Sharp.js style convenient resizing methods.
   * Supports auto-completion and type checking through type-safe interface.
   */
  shortcut: ShortcutBuilder<TState>;

  /**
   * Image resizing (can only be called once)
   *
   * @description The resize() method can only be called once.
   * ImageProcessor rejects additional calls at runtime; the current state types
   * do not enforce this restriction at compile time.
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
  resize(this: IImageProcessor<BeforeResize>, config: ResizeConfig): IImageProcessor<AfterResize>;

  /**
   * Apply blur effect
   *
   * @description Can be used regardless of whether resize() has been called.
   * @param radius Blur radius (default: 2)
   * @param options Blur options (optional)
   * @returns Processor instance with same state
   */
  blur(radius?: number, options?: Partial<BlurOptions>): IImageProcessor<TState>;

  /**
   * Convert to Blob
   */
  toBlob(options?: OutputOptions): Promise<ResultBlob>;
  toBlob(format: OutputFormat): Promise<ResultBlob>;

  /**
   * Convert to Data URL
   */
  toDataURL(options?: OutputOptions): Promise<ResultDataURL>;
  toDataURL(format: OutputFormat): Promise<ResultDataURL>;

  /**
   * Convert to File object
   */
  toFile(filename: string, options?: OutputOptions): Promise<ResultFile>;
  toFile(filename: string, format: OutputFormat): Promise<ResultFile>;

  /**
   * Convert to Canvas
   */
  toCanvas(): Promise<ResultCanvas>;

  /**
   * Canvas result with metadata
   */
  toCanvasDetailed(): Promise<ResultCanvas>;

  /**
   * Create HTMLImageElement directly
   */
  toElement(): Promise<HTMLImageElement>;

  /**
   * Convert to ArrayBuffer directly
   */
  toArrayBuffer(): Promise<ArrayBuffer>;

  /**
   * Convert to Uint8Array directly
   */
  toUint8Array(): Promise<Uint8Array>;
}
