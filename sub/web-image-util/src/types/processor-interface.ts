/**
 * 프로세서 인터페이스 분리
 *
 * @description ImageProcessor의 핵심 인터페이스를 정의합니다.
 * 순환 의존성을 방지하기 위해 인터페이스만 별도로 분리했습니다.
 */

import type { BlurOptions, OutputOptions, ResultBlob, ResultCanvas, ResultDataURL, ResultFile } from './index';
import type { AfterResize, BeforeResize, ProcessorState } from './processor-state';
import type { ResizeConfig, ContainConfig, CoverConfig, MaxFitConfig, MinFitConfig } from './resize-config';
import type { ResizeOperation, ScaleOperation } from './shortcut-types';

/**
 * Shortcut API 인터페이스
 *
 * @description Sharp.js 스타일의 편의 메서드를 정의합니다.
 * 순환 의존성을 방지하기 위해 인터페이스로만 정의하고,
 * 실제 구현은 ShortcutBuilder 클래스에서 담당합니다.
 *
 * @template TState 프로세서 상태 (BeforeResize | AfterResize)
 */
export interface IShortcutBuilder<TState extends ProcessorState> {
  // ============================================================================
  // 🎯 Direct Mapping: 즉시 변환 가능한 메서드들
  // ============================================================================

  /**
   * Cover 모드 리사이징 (이미지를 박스에 꽉 채움, 일부 잘릴 수 있음)
   */
  coverBox(
    width: number,
    height: number,
    options?: Partial<Omit<CoverConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize>;

  /**
   * Contain 모드 리사이징 (이미지 전체를 박스 안에 맞춤, 여백 생김)
   */
  containBox(
    width: number,
    height: number,
    options?: Partial<Omit<ContainConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize>;

  /**
   * Fill 모드 리사이징 (이미지를 정확한 크기로 늘림/압축, 비율 무시)
   */
  exactSize(width: number, height: number): IImageProcessor<AfterResize>;

  /**
   * 최대 너비 제한 (축소만, 확대 안함)
   */
  maxWidth(width: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'width'>>): IImageProcessor<AfterResize>;

  /**
   * 최대 높이 제한 (축소만, 확대 안함)
   */
  maxHeight(height: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'height'>>): IImageProcessor<AfterResize>;

  /**
   * 최대 크기 제한 (축소만, 확대 안함)
   */
  maxSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MaxFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize>;

  /**
   * 최소 너비 보장 (확대만, 축소 안함)
   */
  minWidth(width: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'width'>>): IImageProcessor<AfterResize>;

  /**
   * 최소 높이 보장 (확대만, 축소 안함)
   */
  minHeight(height: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'height'>>): IImageProcessor<AfterResize>;

  /**
   * 최소 크기 보장 (확대만, 축소 안함)
   */
  minSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MinFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize>;

  // ============================================================================
  // 🔄 Lazy Operations: 소스 크기가 필요한 연산들
  // ============================================================================


  // ============================================================================
  // 새로운 메서드 이름들 (v3.0+)
  // ============================================================================

  /**
   * 정확한 너비로 리사이징 (높이는 비율 유지)
   * @since v3.0.0
   */
  exactWidth(width: number): IImageProcessor<AfterResize>;

  /**
   * 정확한 높이로 리사이징 (너비는 비율 유지)
   * @since v3.0.0
   */
  exactHeight(height: number): IImageProcessor<AfterResize>;

  /**
   * 배율 기반 리사이징
   * @since v3.0.0
   */
  scale(scale: ScaleOperation): IImageProcessor<AfterResize>;

  /**
   * X축 배율 리사이징 (편의 메서드)
   * @since v3.0.0
   */
  scaleX(scaleX: number): IImageProcessor<AfterResize>;

  /**
   * Y축 배율 리사이징 (편의 메서드)
   * @since v3.0.0
   */
  scaleY(scaleY: number): IImageProcessor<AfterResize>;

  /**
   * X/Y축 개별 배율 리사이징 (편의 메서드)
   * @since v3.0.0
   */
  scaleXY(scaleX: number, scaleY: number): IImageProcessor<AfterResize>;
}

/**
 * 이미지 프로세서 인터페이스
 *
 * @description ImageProcessor 클래스가 구현하는 핵심 인터페이스입니다.
 * ShortcutBuilder가 이 인터페이스에 의존하여 순환 의존성을 방지합니다.
 *
 * @template TState 프로세서 상태 (BeforeResize | AfterResize)
 */
export interface IImageProcessor<TState extends ProcessorState = BeforeResize> {
  /**
   * Shortcut API 접근자
   *
   * @description Sharp.js 스타일의 간편한 리사이징 메서드를 제공합니다.
   * 타입 안전한 인터페이스를 통해 자동완성과 타입 체크를 지원합니다.
   */
  shortcut: IShortcutBuilder<TState>;

  /**
   * 이미지 리사이징
   * resize() 호출 후에는 AfterResize 상태로 전환됩니다.
   */
  resize(config: ResizeConfig): IImageProcessor<AfterResize>;

  /**
   * 이미지 블러 효과
   * 상태를 유지하면서 체이닝을 지원합니다.
   */
  blur(radius?: number, options?: Partial<BlurOptions>): IImageProcessor<TState>;

  /**
   * Blob으로 변환
   */
  toBlob(options?: OutputOptions): Promise<ResultBlob>;

  /**
   * Data URL로 변환
   */
  toDataURL(options?: OutputOptions): Promise<ResultDataURL>;

  /**
   * File 객체로 변환
   */
  toFile(filename: string, options?: OutputOptions): Promise<ResultFile>;

  /**
   * Canvas로 변환
   */
  toCanvas(): Promise<ResultCanvas>;

  /**
   * Lazy 리사이즈 연산 추가 (내부 API)
   *
   * @description ShortcutBuilder가 사용하는 내부 메서드입니다.
   * 소스 크기가 필요한 연산을 pending 상태로 저장합니다.
   *
   * @internal
   */
  _addResizeOperation(operation: ResizeOperation): void;
}

/**
 * 초기 프로세서 타입 (resize() 호출 전)
 */
export type InitialProcessorInterface = IImageProcessor<BeforeResize>;

/**
 * 리사이징 후 프로세서 타입 (resize() 호출 후)
 */
export type ResizedProcessorInterface = IImageProcessor<AfterResize>;
