/**
 * ImageProcessor의 지연 파이프라인 초기화를 담당하는 helper다.
 *
 * @description 입력 소스를 HTMLImageElement로 정규화하고 LazyRenderPipeline을 생성한 뒤,
 * 초기화 전에 예약된 resize/blur 연산을 정해진 순서대로 반영한다. resize config →
 * resize operation → blur 순서를 보존한다. 호출부(processor.ts)가 자신의 private 필드를
 * 입력으로 넘기고, 반환된 pipeline/sourceImage를 필드에 반영한 뒤 pending 필드를 비운다.
 * 새 public export는 만들지 않는다(index.ts에서 re-export 금지).
 */

import { LazyRenderPipeline } from '../core/lazy-render-pipeline.internal';
import { convertToImageElement } from '../core/source-converter.internal';
import type { InternalProcessorOptions } from '../processor';
import type { BlurOptions, ImageSource } from '../types';
import { ImageProcessError } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import type { ResizeOperation } from '../types/shortcut-types';

/**
 * `setupLazyPipeline()` 초기화에 필요한 입력이다.
 *
 * @description 호출부의 현재 상태(이미 만들어진 pipeline/sourceImage와 pending 연산)를 그대로 전달한다.
 */
export interface EnsureLazyPipelineInput {
  source: ImageSource;
  options: InternalProcessorOptions;
  currentPipeline: LazyRenderPipeline | null;
  currentSourceImage: HTMLImageElement | null;
  pendingResizeConfig: ResizeConfig | null;
  pendingResizeOperation: ResizeOperation | null;
  pendingBlurOptions: BlurOptions[];
}

/**
 * `setupLazyPipeline()` 초기화 결과다.
 *
 * @description 호출부가 이 값을 자신의 필드에 반영한다.
 */
export interface EnsureLazyPipelineResult {
  lazyPipeline: LazyRenderPipeline;
  sourceImage: HTMLImageElement;
}

/**
 * 지연 파이프라인을 준비한다.
 *
 * @description 이미 초기화된 pipeline이 있으면 그대로 반환하고, 없으면 source를
 * HTMLImageElement로 로딩한 뒤 LazyRenderPipeline을 생성한다. 그다음 pending 연산을
 * resize config → resize operation → blur 순서로 반영한다. pending 필드를 비우는 책임은
 * 호출부에 있다(이미 초기화된 경우에는 비우지 않는다).
 */
export async function setupLazyPipeline(input: EnsureLazyPipelineInput): Promise<EnsureLazyPipelineResult> {
  // 이미 초기화된 경우 기존 pipeline/sourceImage를 그대로 돌려준다.
  if (input.currentPipeline) {
    // pipeline과 sourceImage는 항상 함께 설정된다(불변식). 캐스팅 대신 명시적으로 확인한다.
    if (!input.currentSourceImage) {
      throw new ImageProcessError('초기화된 pipeline에 sourceImage가 없습니다', 'PROCESSING_FAILED');
    }
    return {
      lazyPipeline: input.currentPipeline,
      sourceImage: input.currentSourceImage,
    };
  }

  // 입력 소스를 공통 이미지 요소로 바꾼다.
  const sourceImage = await convertToImageElement(input.source, input.options);

  // 이후 연산을 쌓아 둘 지연 파이프라인을 만든다.
  const lazyPipeline = new LazyRenderPipeline(sourceImage);

  // 초기화 전에 예약된 연산을 순서대로 반영한다.
  if (input.pendingResizeConfig) {
    lazyPipeline.addResize(input.pendingResizeConfig);
  }

  // Shortcut API에서 예약한 리사이즈 연산도 이어서 반영한다.
  if (input.pendingResizeOperation) {
    lazyPipeline._addResizeOperation(input.pendingResizeOperation);
  }

  // 대기 중인 블러 연산도 모두 연결한다.
  for (const blurOption of input.pendingBlurOptions) {
    lazyPipeline.addBlur(blurOption);
  }

  return { lazyPipeline, sourceImage };
}
