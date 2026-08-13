/**
 * source-converter 내부에서 공유하는 옵션 리졸버와 상수다.
 */

import type { SvgSanitizerMode } from '../../svg-contract.internal';
import type { ProcessorOptions } from '../../types';
import { ImageProcessError } from '../../types';
import type { SvgRenderingOptions } from './svg/loader.internal';

/** SVG 처리 경로를 제어하는 내부 전용 모드 타입이다. 공개 index.ts에서 재export하지 않는다. */
export type SvgPassthroughMode = 'safe' | 'unsafe-pass-through';

/** 공개 ProcessorOptions를 확장하는 내부 전용 옵션 타입이다. */
export type InternalSourceConverterOptions = ProcessorOptions & {
  __svgPassthroughMode?: SvgPassthroughMode;
};

/** options에서 SVG passthrough 모드를 추출한다. 기본값은 안전한 'safe'다. */
export function resolvePassthroughMode(options: InternalSourceConverterOptions | undefined): SvgPassthroughMode {
  return options?.__svgPassthroughMode ?? 'safe';
}

/** options에서 SVG sanitizer 정책을 추출한다. 기본값은 기존 동작과 같은 lightweight다. */
export function resolveSvgSanitizerMode(options: InternalSourceConverterOptions | undefined): SvgSanitizerMode {
  if (options?.__svgPassthroughMode === 'unsafe-pass-through') {
    return 'skip';
  }

  const mode = options?.svgSanitizer ?? 'lightweight';
  if (mode === 'lightweight' || mode === 'strict' || mode === 'skip') {
    return mode;
  }

  throw new ImageProcessError(`Unsupported SVG sanitizer mode: ${String(mode)}`, 'INVALID_SOURCE', {
    details: { mode },
  });
}

/**
 * SVG 공통 처리기(`convertSvgToElement`)에 넘길 렌더링 옵션을 조립한다.
 *
 * 소스 형태별 분기마다 같은 리터럴을 반복하지 않도록 조립 지점을 한 곳으로 모은다.
 *
 * @param options 내부 소스 변환 옵션
 * @returns SVG 렌더링 옵션
 */
export function buildSvgRenderOptions(options: InternalSourceConverterOptions | undefined): SvgRenderingOptions {
  return {
    quality: 'auto',
    crossOrigin: options?.crossOrigin,
    passthroughMode: resolvePassthroughMode(options),
    sanitizerMode: resolveSvgSanitizerMode(options),
  };
}

/** 기본 fetch 타임아웃 (30초). */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/** 기본 최대 소스 바이트 수 (100MiB). */
export const DEFAULT_MAX_SOURCE_BYTES = 100 * 1024 * 1024;

/** 기본 허용 프로토콜 목록. */
export const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:', 'blob:', 'data:'];

/**
 * 원격 소스 로딩에 사용할 fetch 타임아웃 값을 계산한다.
 *
 * `fetchTimeoutMs`가 최우선이며, 하위 호환을 위해 `timeout`도 동일 의미로 받아들인다.
 *
 * @param options 프로세서 옵션
 * @returns 실제 적용할 타임아웃 값
 */
export function resolveFetchTimeoutMs(options?: ProcessorOptions): number {
  if (options?.fetchTimeoutMs !== undefined) {
    return options.fetchTimeoutMs;
  }

  if (options?.timeout !== undefined) {
    return options.timeout;
  }

  return DEFAULT_FETCH_TIMEOUT_MS;
}
