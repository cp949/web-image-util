import { MAX_SVG_BYTES } from '../../core/source-converter/options.internal';
import { ImageProcessError } from '../../errors';
// 타입만 import — JS 런타임 순환 차단. 런타임 값 import 추가 시 순환이 남는다.
import type { InspectSvgSourceInput, InspectSvgSourceOptions } from '../inspect-svg-source';

/**
 * source 타입이 허용 입력(string | Blob | File | URL)인지 검증한다(D2, D13).
 * 비허용 타입이면 SVG_SOURCE_INVALID를 던진다.
 */
export function assertInspectSvgSourceInput(source: unknown): asserts source is InspectSvgSourceInput {
  const isAllowed =
    typeof source === 'string' || source instanceof Blob || source instanceof File || source instanceof URL;

  if (!isAllowed) {
    const actualType = source === null ? 'null' : typeof source;
    throw new ImageProcessError(
      `inspectSvgSource expects a string, Blob, File, or URL, but received ${actualType}.`,
      'SVG_SOURCE_INVALID',
      { details: { actualType } }
    );
  }
}

/**
 * options 각 필드가 허용 범위인지 검증한다(D13).
 * 위반 시 OPTION_INVALID를 던진다.
 */
export function assertInspectSvgSourceOptions(options: InspectSvgSourceOptions | undefined): void {
  if (options === undefined) return;

  // TS 타입으로 차단되지만 untyped JS 호출자 대비 런타임 검증을 유지한다.
  if (options.fetch !== undefined && !['never', 'metadata', 'body'].includes(options.fetch)) {
    throw new ImageProcessError(
      `inspectSvgSource expects options.fetch to be 'never' | 'metadata' | 'body'.`,
      'OPTION_INVALID',
      { details: { option: 'fetch' } }
    );
  }

  if (
    options.byteLimit !== undefined &&
    (!Number.isInteger(options.byteLimit) || options.byteLimit < 1 || options.byteLimit > MAX_SVG_BYTES)
  ) {
    throw new ImageProcessError(
      `inspectSvgSource expects options.byteLimit to be an integer between 1 and MAX_SVG_BYTES.`,
      'OPTION_INVALID',
      { details: { option: 'byteLimit' } }
    );
  }

  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0)) {
    throw new ImageProcessError(
      `inspectSvgSource expects options.timeoutMs to be a positive integer.`,
      'OPTION_INVALID',
      { details: { option: 'timeoutMs' } }
    );
  }

  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new ImageProcessError(`inspectSvgSource expects options.signal to be an AbortSignal.`, 'OPTION_INVALID', {
      details: { option: 'signal' },
    });
  }
}
