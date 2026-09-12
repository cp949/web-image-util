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
import type { BoxOptions } from './box-config';
import type { BlurOptions, OutputOptions, ResultBlob, ResultCanvas, ResultDataURL, ResultFile } from './output-types';
import type { AfterResize, BeforeResize, ProcessorState } from './processor-state.internal';
import type { ResizeConfig } from './resize-config';
import type { TransformOptions } from './transform-config';

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
   * crop / flip / rotate 변환 (한 번만, resize() 앞에서만)
   *
   * @description
   * 호출 순서와 무관하게 crop → flip → rotate → resize 순서로 계산되고,
   * 최종 출력 시점에 drawImage 한 번으로 렌더된다. crop 좌표는 원본 픽셀 기준이다.
   * resize() 뒤에는 호출할 수 없다. ImageProcessor가 런타임에 거부한다(현재 상태 타입은
   * 이 제약을 컴파일 타임에 강제하지 않는다 — resize()와 같다). 두 번째 호출도 런타임 오류다.
   * crop이 원본과 겹치지 않으면 출력 시점에 `INVALID_DIMENSIONS`다. 단, `toCanvas()`/`toCanvasDetailed()`는
   * 이 오류를 `OUTPUT_FAILED`로 감싸 던진다(원인은 `cause`에 보존).
   *
   * @param options 변환 옵션. 빈 객체는 no-op
   * @returns 같은 상태(BeforeResize)의 프로세서 — resize()를 이어서 부를 수 있다
   *
   * @example
   * ```typescript
   * await processImage(source)
   *   .transform({ crop: { x: 10, y: 20, width: 640, height: 480 }, rotate: 90 })
   *   .resize({ fit: 'cover', width: 320, height: 240 })
   *   .toBlob();
   * ```
   */
  transform(this: IImageProcessor<BeforeResize>, options: TransformOptions): IImageProcessor<BeforeResize>;

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
   * padding / background / radius / border를 CSS box model 의미로 지정한다
   *
   * @description
   * 한 체인에서 한 번만 호출할 수 있다. `resize()`와 달리 체인 위치 제약이 없다 —
   * `resize()` 앞뒤 어디서 불러도 항상 transform → resize → box 순서(가장 바깥)로 적용된다.
   * 원본과 목표 비율이 다른 `resize({ fit: 'cover' })`와 함께 쓰면 이미지가 padding 영역까지
   * 번질 수 있다 — `radius`를 지정해도 막히지 않는다(현재 완화 방법 없음).
   *
   * @param options box 옵션. 빈 객체는 no-op
   * @returns 같은 상태의 프로세서 — 상태를 바꾸지 않는다(`blur()`와 같은 방식)
   *
   * @example
   * ```typescript
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 128, height: 128 })
   *   .box({ padding: 4, background: '#fff', radius: '50%', border: { width: 2, color: '#333' } })
   *   .toBlob('png');
   * ```
   */
  box(options: BoxOptions): IImageProcessor<TState>;

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
