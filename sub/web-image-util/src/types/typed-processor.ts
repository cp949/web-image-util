/**
 * 타입-안전한 이미지 프로세서 인터페이스
 *
 * @description resize() 호출 상태를 TypeScript 타입 시스템으로 추적하여
 * 컴파일 타임에 잘못된 사용법을 방지합니다.
 */

import type { BlurOptions, ResultBlob, ResultCanvas, ResultDataURL, ResultFile } from '../types';
import type { AfterResize, AfterResizeCall, BeforeResize, EnsureCanResize, ProcessorState } from './processor-state';
import type { ResizeConfig } from './resize-config';
import type { IShortcutBuilder } from './processor-interface';

// 다른 모듈에서 사용할 수 있도록 re-export
export type { AfterResize, BeforeResize } from './processor-state';

/**
 * 타입-안전한 이미지 프로세서 인터페이스
 *
 * @template TState 현재 프로세서 상태 (BeforeResize | AfterResize)
 */
export interface TypedImageProcessor<TState extends ProcessorState = BeforeResize> {
  /**
   * Shortcut API 접근자
   *
   * @description Sharp.js 스타일의 간편한 리사이징 메서드를 제공합니다.
   * 타입 안전한 인터페이스를 통해 자동완성과 타입 체크를 지원합니다.
   */
  shortcut: IShortcutBuilder<TState>;

  /**
   * 이미지 리사이징 (한 번만 호출 가능)
   *
   * @description resize() 메서드는 한 번만 호출할 수 있습니다.
   * 여러 번 호출하면 컴파일 에러가 발생합니다.
   *
   * @param config 리사이징 설정
   * @returns resize() 호출 후 상태의 프로세서 인스턴스
   *
   * @example
   * ```typescript
   * const processor = processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 });
   * ```
   */
  resize(
    config: ResizeConfig,
    // 타입 레벨 제약: resize() 호출 가능한 상태에서만 사용 가능
    _constraint?: EnsureCanResize<TState>
  ): TypedImageProcessor<AfterResizeCall<TState>>;

  /**
   * 블러 효과 적용
   *
   * @description resize() 호출 여부와 관계없이 사용 가능합니다.
   * @param radius 블러 반지름 (기본: 2)
   * @param options 블러 옵션 (선택사항)
   * @returns 동일한 상태의 프로세서 인스턴스
   */
  blur(radius?: number, options?: Partial<BlurOptions>): TypedImageProcessor<TState>;

  /**
   * Blob 형태로 결과 반환
   */
  toBlob(options?: any): Promise<ResultBlob>;
  toBlob(format?: string): Promise<ResultBlob>;

  /**
   * Canvas 형태로 결과 반환
   */
  toCanvas(): Promise<ResultCanvas>;

  /**
   * Data URL 형태로 결과 반환
   */
  toDataURL(options?: any): Promise<ResultDataURL>;
  toDataURL(format?: string): Promise<ResultDataURL>;

  /**
   * File 형태로 결과 반환
   */
  toFile(filename?: string, options?: any): Promise<ResultFile>;
  toFile(filename?: string, format?: string): Promise<ResultFile>;
}

/**
 * 초기 프로세서 타입 (resize() 호출 전)
 */
export type InitialProcessor = TypedImageProcessor<BeforeResize>;

/**
 * 리사이징 완료 프로세서 타입 (resize() 호출 후)
 */
export type ResizedProcessor = TypedImageProcessor<AfterResize>;

/**
 * 프로세서 팩토리 함수 타입
 */
export type ProcessorFactory = (source: any) => InitialProcessor;

/**
 * 타입 유틸리티: 현재 상태 확인
 */
export type GetProcessorState<T> = T extends TypedImageProcessor<infer S> ? S : never;

/**
 * 타입 유틸리티: resize() 호출 가능 여부
 */
export type CanCallResize<T> = T extends TypedImageProcessor<BeforeResize> ? true : false;
