/**
 * Lazy rendering pipeline - Handle all operations as calculations only and render once at the end
 *
 * Core philosophy: "Calculate first, render once"
 * - Accumulate all resize, blur operations in memory
 * - Perform actual rendering only when toBlob(), toCanvas() is called
 * - Generate final result only without creating intermediate Canvas
 *
 * resize 1회 불변식의 런타임 소유자다 — 가드와 설정 검증은 addResize 한 곳에만 있다.
 * (컴파일 타임 전이는 AfterResizeCall 타입이 보조한다)
 * transform 1회·resize 앞 불변식도 같은 이유로 addTransform 한 곳에만 있다.
 * box 1회 불변식과 resize.padding/background 동시 지정 금지(양방향)도 addBox·addResize 두 곳이 소유한다.
 */

import type { CanvasLease } from '../base/canvas-lease.internal';
import { createQuickError } from '../base/error-helpers';
import type { BlurOptions, ResultMetadata } from '../types';
import { ImageProcessError } from '../types';
import { type BoxOptions, normalizeBoxOptions, validateBoxOptions } from '../types/box-config';
import type { ResizeConfig } from '../types/resize-config';
import { validateResizeConfig } from '../types/resize-config';
import { normalizeTransformOptions, type TransformOptions, validateTransformOptions } from '../types/transform-config';
import { analyzeAllOperations, debugLayout, type LazyOperation, renderLayout } from './single-renderer.internal';

/**
 * Lazy rendering pipeline
 *
 * Unlike traditional pipelines that draw to Canvas immediately for each operation,
 * this completes all calculations first and renders only once at the end.
 *
 * 소스 이미지는 출력 시점에야 로딩되므로 생성 시점에는 받지 않고
 * {@link render}의 인자로 받는다 — 덕분에 OutputPipeline이 생성 직후부터
 * 연산을 이 파이프라인에 직접 축적할 수 있다(pending 재생 없음).
 */
export class LazyRenderPipeline {
  private operations: LazyOperation[] = [];
  private resizeCalled = false;
  private transformCalled = false;
  private boxCalled = false;

  /**
   * Add resize operation (calculation only, no rendering)
   *
   * resize 1회 불변식과 설정 검증의 단일 지점이다.
   * 검증 실패 시 어떤 상태도 남기지 않는다.
   */
  addResize(config: ResizeConfig): this {
    if (this.resizeCalled) {
      throw createQuickError('MULTIPLE_RESIZE_NOT_ALLOWED');
    }
    if (this.boxCalled && (config.padding !== undefined || config.background !== undefined)) {
      throw new ImageProcessError(
        'resize()의 padding/background는 box()와 함께 쓸 수 없다. box()로 통일하라.',
        'OPTION_INVALID',
        { details: { option: 'resize.padding/background' } }
      );
    }
    validateResizeConfig(config);
    this.resizeCalled = true;
    this.operations.push({ type: 'resize', config });
    return this;
  }

  /**
   * transform 연산 추가 (계산만, 렌더 없음)
   *
   * 1회 제약과 "resize() 앞" 제약의 단일 지점이다. 검증 실패 시 어떤 상태도 남기지 않는다.
   * 인터페이스의 `this: IImageProcessor<BeforeResize>` 제약은 의도 표시일 뿐 컴파일 타임
   * 집행력이 없다(구조적 타이핑으로 무력화됨). 실제 집행은 이 메서드의 런타임 가드뿐이다.
   * 원본 크기가 필요한 crop 교집합 판정은 렌더 시점(analyzeAllOperations)에 한다.
   */
  addTransform(options: TransformOptions): this {
    if (this.transformCalled) {
      throw new ImageProcessError(
        'transform() can only be called once. Create a new processImage() instance.',
        'OPTION_INVALID',
        { details: { option: 'transform' } }
      );
    }
    if (this.resizeCalled) {
      throw new ImageProcessError('transform() must be called before resize().', 'OPTION_INVALID', {
        details: { option: 'transform' },
      });
    }
    validateTransformOptions(options);
    const transform = normalizeTransformOptions(options);
    this.transformCalled = true;
    this.operations.push({ type: 'transform', transform });
    return this;
  }

  /**
   * Add blur operation (calculation only, no rendering)
   * Multiple calls allowed
   */
  addBlur(options: BlurOptions): this {
    this.operations.push({ type: 'blur', options });
    return this;
  }

  /**
   * box 연산 추가(계산만, 렌더 없음)
   *
   * 1회 제약의 단일 지점이다. resize()와 달리 체인 위치 제약은 없다(앞뒤 모두 가능) —
   * "가장 바깥에 적용"이라는 순서는 analyzeAllOperations가 배열 위치와 무관하게 보장한다.
   * resize.padding/background(deprecated)와의 동시 지정 금지는 이미 누적된 resize 연산을
   * 스캔해서 확인한다 — resize()가 box() 뒤에 padding/background로 호출되는 경우는
   * addResize가 대칭적으로 막는다. 검증 실패 시 어떤 상태도 남기지 않는다.
   */
  addBox(options: BoxOptions): this {
    if (this.boxCalled) {
      throw new ImageProcessError(
        'box() can only be called once. Create a new processImage() instance.',
        'OPTION_INVALID',
        {
          details: { option: 'box' },
        }
      );
    }
    const resizeOperation = this.operations.find(
      (op): op is Extract<LazyOperation, { type: 'resize' }> => op.type === 'resize'
    );
    if (
      resizeOperation &&
      (resizeOperation.config.padding !== undefined || resizeOperation.config.background !== undefined)
    ) {
      throw new ImageProcessError(
        'box()는 resize()의 padding/background와 함께 쓸 수 없다. resize()에서 그 옵션을 빼거나 box()를 쓰지 마라.',
        'OPTION_INVALID',
        { details: { option: 'box' } }
      );
    }
    validateBoxOptions(options);
    const box = normalizeBoxOptions(options);
    this.boxCalled = true;
    this.operations.push({ type: 'box', box });
    return this;
  }

  /**
   * 🚀 Core: 모든 계산을 마친 뒤 단 한 번 렌더링한다.
   *
   * @param sourceImage 로딩이 끝난 소스 이미지 — scale·단일 축 fill 같은
   *   원본 크기 의존 설정은 이 시점에 calculateFinalLayout이 해석한다.
   *
   * 결과 canvas는 pool 소유이며 {@link CanvasLease}에 담겨 반환된다.
   * 소비자는 lease.consume()으로 파생물을 만들거나(사용 후 pool 반환),
   * lease.detach()로 소유권을 가져간다(toCanvas 계열 — pool로 돌아가지 않음).
   */
  render(sourceImage: HTMLImageElement): { lease: CanvasLease; metadata: ResultMetadata } {
    const startTime = performance.now();

    // layout은 한 번만 계산해 렌더링과 디버그 출력에 재사용한다
    const layout = analyzeAllOperations(sourceImage, this.operations);
    const lease = renderLayout(sourceImage, layout);

    try {
      const canvas = lease.canvas;
      const metadata: ResultMetadata = {
        width: canvas.width,
        height: canvas.height,
        // format은 인코딩 시점(toBlob 등)에 결정된다 — 렌더 단계에서는 없다.
        size: canvas.width * canvas.height * 4, // RGBA estimation
        processingTime: performance.now() - startTime,
        operations: this.operations.length,
      };

      debugLayout(layout, this.operations.length);

      return { lease, metadata };
    } catch (error) {
      // 예외 발생 시 canvas를 pool에 반환하여 누수를 방지한다.
      lease.release();
      throw error;
    }
  }

  /**
   * Get operation count (for debugging)
   */
  getOperationCount(): number {
    return this.operations.length;
  }

  /**
   * Get operations list (for debugging)
   */
  getOperations(): LazyOperation[] {
    return [...this.operations];
  }
}
