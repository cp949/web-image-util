/**
 * ShortcutBuilder - 간편 리사이징 메서드 모음
 *
 * @description
 * 복잡한 ResizeConfig 객체 대신 직관적인 메서드 이름으로 리사이징을 수행할 수 있는
 * Shortcut API를 제공합니다.
 *
 * **장점:**
 * - 더 짧고 읽기 쉬운 코드
 * - 메서드 이름만으로 의도 파악 가능
 * - IDE 자동완성으로 빠른 작성
 *
 * @example
 * ```typescript
 * // 기본 방식
 * processImage(src).resize({ fit: 'cover', width: 300, height: 200 });
 *
 * // Shortcut API (더 간결함)
 * processImage(src).shortcut.coverBox(300, 200);
 *
 * // 다양한 shortcut 메서드
 * processImage(src).shortcut.maxWidth(500);                 // 최대 너비 제한
 * processImage(src).shortcut.scale(1.5);                    // 1.5배 확대
 * processImage(src).shortcut.exactSize(400, 300);           // 정확한 크기
 * ```
 */

import type { IImageProcessor, IShortcutBuilder } from '../types/processor-interface';
import type { AfterResize, ProcessorState } from '../types/processor-state';
import type { ContainConfig, CoverConfig, MaxFitConfig, MinFitConfig } from '../types/resize-config';
import type { ScaleOperation } from '../types/shortcut-types';

/**
 * ShortcutBuilder 클래스
 *
 * @template TState 현재 프로세서 상태 (BeforeResize | AfterResize)
 */
export class ShortcutBuilder<TState extends ProcessorState> implements IShortcutBuilder<TState> {
  constructor(private processor: IImageProcessor<TState>) {}

  // ============================================================================
  // 🎯 Group 1: 직접 매핑 (Direct Mapping)
  // ResizeConfig로 즉시 변환 가능한 메서드들
  // ============================================================================

  /**
   * Cover 모드 리사이징 (이미지를 박스에 꽉 채움, 일부 잘릴 수 있음)
   *
   * @description
   * CSS object-fit: cover와 동일한 동작을 합니다.
   * 이미지의 비율을 유지하면서 지정된 박스를 완전히 채웁니다.
   * 이미지가 박스보다 크면 잘리고, 작으면 확대됩니다.
   *
   * @param width 출력 너비 (픽셀)
   * @param height 출력 높이 (픽셀)
   * @param options 추가 옵션 (padding, background)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 기본 사용
   * await processImage(src).shortcut.coverBox(300, 200).toBlob();
   *
   * // 옵션과 함께 사용
   * await processImage(src).shortcut.coverBox(300, 200, {
   *   padding: 10,
   *   background: '#ffffff'
   * }).toBlob();
   * ```
   */
  coverBox(
    width: number,
    height: number,
    options?: Partial<Omit<CoverConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'cover',
      width,
      height,
      ...options,
    });
  }

  /**
   * Contain 모드 리사이징 (이미지 전체를 박스 안에 맞춤, 여백 생김)
   *
   * @description
   * CSS object-fit: contain과 동일한 동작을 합니다.
   * 이미지의 비율을 유지하면서 전체 이미지가 박스 안에 들어가도록 합니다.
   * 이미지가 박스보다 작을 때 확대할지 여부를 withoutEnlargement로 제어합니다.
   *
   * @param width 출력 너비 (픽셀)
   * @param height 출력 높이 (픽셀)
   * @param options 추가 옵션 (trimEmpty, withoutEnlargement, padding, background)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 기본 사용 (확대/축소 모두 수행)
   * await processImage(src).shortcut.containBox(300, 200).toBlob();
   *
   * // 확대 방지 (축소만)
   * await processImage(src).shortcut.containBox(300, 200, {
   *   withoutEnlargement: true
   * }).toBlob();
   *
   * // 여백 자동 제거
   * await processImage(src).shortcut.containBox(300, 200, {
   *   trimEmpty: true,
   *   background: '#ffffff'
   * }).toBlob();
   * ```
   */
  containBox(
    width: number,
    height: number,
    options?: Partial<Omit<ContainConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'contain',
      width,
      height,
      ...options,
    });
  }

  /**
   * Fill 모드 리사이징 (이미지를 정확한 크기로 늘림/압축, 비율 무시)
   *
   * @description
   * CSS object-fit: fill과 동일한 동작을 합니다.
   * 이미지의 비율을 무시하고 정확히 지정된 크기로 맞춥니다.
   * 이미지가 늘어나거나 압축될 수 있습니다.
   *
   * @param width 출력 너비 (픽셀)
   * @param height 출력 높이 (픽셀)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 정확히 300x200 크기로 변환 (비율 무시)
   * await processImage(src).shortcut.exactSize(300, 200).toBlob();
   * ```
   */
  exactSize(width: number, height: number): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'fill',
      width,
      height,
    });
  }

  /**
   * 최대 너비 제한 (축소만, 확대 안함)
   *
   * @description
   * 이미지의 너비가 지정된 값보다 크면 축소합니다.
   * 이미지가 지정된 값보다 작으면 원본 크기를 유지합니다.
   * 비율은 항상 유지됩니다.
   *
   * @param width 최대 너비 (픽셀)
   * @param options 추가 옵션 (padding, background)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 너비가 500px을 넘지 않도록 제한 (비율 유지, 축소만)
   * await processImage(src).shortcut.maxWidth(500).toBlob();
   * ```
   */
  maxWidth(width: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'width'>>): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'maxFit',
      width,
      ...options,
    });
  }

  /**
   * 최대 높이 제한 (축소만, 확대 안함)
   *
   * @description
   * 이미지의 높이가 지정된 값보다 크면 축소합니다.
   * 이미지가 지정된 값보다 작으면 원본 크기를 유지합니다.
   * 비율은 항상 유지됩니다.
   *
   * @param height 최대 높이 (픽셀)
   * @param options 추가 옵션 (padding, background)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 높이가 400px을 넘지 않도록 제한 (비율 유지, 축소만)
   * await processImage(src).shortcut.maxHeight(400).toBlob();
   * ```
   */
  maxHeight(height: number, options?: Partial<Omit<MaxFitConfig, 'fit' | 'height'>>): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'maxFit',
      height,
      ...options,
    });
  }

  /**
   * 최대 크기 제한 (축소만, 확대 안함)
   *
   * @description
   * 이미지의 너비 또는 높이가 지정된 값보다 크면 축소합니다.
   * 이미지가 지정된 값보다 작으면 원본 크기를 유지합니다.
   * 비율은 항상 유지됩니다.
   * 너비와 높이 중 더 큰 비율에 맞춰 축소됩니다.
   *
   * @param size 최대 크기 ({ width, height })
   * @param options 추가 옵션 (padding, background)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 800x600 박스 안에 들어가도록 제한 (비율 유지, 축소만)
   * await processImage(src).shortcut.maxSize({ width: 800, height: 600 }).toBlob();
   * ```
   */
  maxSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MaxFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'maxFit',
      ...size,
      ...options,
    });
  }

  /**
   * 최소 너비 보장 (확대만, 축소 안함)
   *
   * @description
   * 이미지의 너비가 지정된 값보다 작으면 확대합니다.
   * 이미지가 지정된 값보다 크면 원본 크기를 유지합니다.
   * 비율은 항상 유지됩니다.
   *
   * @param width 최소 너비 (픽셀)
   * @param options 추가 옵션 (padding, background)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 너비가 최소 300px이 되도록 보장 (비율 유지, 확대만)
   * await processImage(src).shortcut.minWidth(300).toBlob();
   * ```
   */
  minWidth(width: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'width'>>): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'minFit',
      width,
      ...options,
    });
  }

  /**
   * 최소 높이 보장 (확대만, 축소 안함)
   *
   * @description
   * 이미지의 높이가 지정된 값보다 작으면 확대합니다.
   * 이미지가 지정된 값보다 크면 원본 크기를 유지합니다.
   * 비율은 항상 유지됩니다.
   *
   * @param height 최소 높이 (픽셀)
   * @param options 추가 옵션 (padding, background)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 높이가 최소 200px이 되도록 보장 (비율 유지, 확대만)
   * await processImage(src).shortcut.minHeight(200).toBlob();
   * ```
   */
  minHeight(height: number, options?: Partial<Omit<MinFitConfig, 'fit' | 'height'>>): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'minFit',
      height,
      ...options,
    });
  }

  /**
   * 최소 크기 보장 (확대만, 축소 안함)
   *
   * @description
   * 이미지의 너비 또는 높이가 지정된 값보다 작으면 확대합니다.
   * 이미지가 지정된 값보다 크면 원본 크기를 유지합니다.
   * 비율은 항상 유지됩니다.
   * 너비와 높이 중 더 작은 비율에 맞춰 확대됩니다.
   *
   * @param size 최소 크기 ({ width, height })
   * @param options 추가 옵션 (padding, background)
   * @returns AfterResize 상태의 IImageProcessor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // 400x300 박스를 완전히 채우도록 보장 (비율 유지, 확대만)
   * await processImage(src).shortcut.minSize({ width: 400, height: 300 }).toBlob();
   * ```
   */
  minSize(
    size: { width: number; height: number },
    options?: Partial<Omit<MinFitConfig, 'fit' | 'width' | 'height'>>
  ): IImageProcessor<AfterResize> {
    return this.processor.resize({
      fit: 'minFit',
      ...size,
      ...options,
    });
  }

  // ============================================================================
  // 🔄 Group 2: Lazy 연산 (Lazy Operations)
  // 소스 크기가 필요한 연산들 - 최종 출력 시점에 계산
  // ============================================================================


  // ============================================================================
  // 배율 및 정확한 크기 조정 메서드
  // ============================================================================

  /**
   * 정확한 너비로 리사이징 (높이는 비율 유지)
   *
   * @description
   * 지정된 너비로 리사이징하고, 높이는 비율을 유지합니다.
   *
   * @param width 목표 너비 (픽셀)
   * @returns AfterResize 상태의 IImageProcessor
   *
   * @example
   * ```typescript
   * // 너비 800px, 높이는 자동 계산
   * await processImage(src).shortcut.exactWidth(800).toBlob();
   * ```
   */
  exactWidth(width: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'toWidth', width });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * 정확한 높이로 리사이징 (너비는 비율 유지)
   *
   * @description
   * 지정된 높이로 리사이징하고, 너비는 비율을 유지합니다.
   *
   * @param height 목표 높이 (픽셀)
   * @returns AfterResize 상태의 IImageProcessor
   *
   * @example
   * ```typescript
   * // 높이 600px, 너비는 자동 계산
   * await processImage(src).shortcut.exactHeight(600).toBlob();
   * ```
   */
  exactHeight(height: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'toHeight', height });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * 배율 기반 리사이징
   *
   * @description
   * 배율을 지정하여 이미지를 확대 또는 축소합니다.
   * 숫자 하나로 균등 배율, 객체로 축별 배율 지정 가능합니다.
   *
   * @param scale 배율 (숫자 또는 { sx?, sy? } 객체)
   * @returns AfterResize 상태의 IImageProcessor
   *
   * @example
   * ```typescript
   * // 균등 배율
   * await processImage(src).shortcut.scale(1.5).toBlob();           // 1.5배 확대
   * await processImage(src).shortcut.scale(0.5).toBlob();           // 0.5배 축소
   *
   * // 축별 배율
   * await processImage(src).shortcut.scale({ sx: 2 }).toBlob();     // X축만 2배
   * await processImage(src).shortcut.scale({ sy: 1.5 }).toBlob();   // Y축만 1.5배
   * await processImage(src).shortcut.scale({ sx: 2, sy: 0.75 }).toBlob(); // X축 2배, Y축 0.75배
   * ```
   */
  scale(scale: ScaleOperation): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'scale', value: scale });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * X축 배율 리사이징
   *
   * @description
   * X축(너비)만 배율을 적용합니다. 높이는 원본 유지됩니다.
   *
   * @param scaleX X축 배율
   * @returns AfterResize 상태의 IImageProcessor
   *
   * @example
   * ```typescript
   * // 너비만 2배 확대
   * await processImage(src).shortcut.scaleX(2).toBlob();
   * ```
   */
  scaleX(scaleX: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'scale', value: { sx: scaleX } });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * Y축 배율 리사이징
   *
   * @description
   * Y축(높이)만 배율을 적용합니다. 너비는 원본 유지됩니다.
   *
   * @param scaleY Y축 배율
   * @returns AfterResize 상태의 IImageProcessor
   *
   * @example
   * ```typescript
   * // 높이만 0.5배 축소
   * await processImage(src).shortcut.scaleY(0.5).toBlob();
   * ```
   */
  scaleY(scaleY: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'scale', value: { sy: scaleY } });
    return this.processor as IImageProcessor<AfterResize>;
  }

  /**
   * X/Y축 개별 배율 리사이징
   *
   * @description
   * X축과 Y축에 각각 다른 배율을 적용합니다.
   *
   * @param scaleX X축 배율
   * @param scaleY Y축 배율
   * @returns AfterResize 상태의 IImageProcessor
   *
   * @example
   * ```typescript
   * // 너비 2배, 높이 1.5배
   * await processImage(src).shortcut.scaleXY(2, 1.5).toBlob();
   * ```
   */
  scaleXY(scaleX: number, scaleY: number): IImageProcessor<AfterResize> {
    this.processor._addResizeOperation({ type: 'scale', value: { sx: scaleX, sy: scaleY } });
    return this.processor as IImageProcessor<AfterResize>;
  }
}
