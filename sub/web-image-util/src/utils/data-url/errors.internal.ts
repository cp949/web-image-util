/**
 * Data URL 처리 중 발생하는 오류를 일관된 형태로 throw한다.
 *
 * 모든 throw는 `ImageProcessError`를 통해 이뤄지며, 호출자는 `code`로 분기한다.
 */
import { ImageProcessError } from '../../errors';

export type InvalidDataUrlKind = 'malformed' | 'invalid-base64' | 'invalid-percent';

export function throwInvalidDataURL(kind: InvalidDataUrlKind = 'malformed', cause?: unknown): never {
  throw new ImageProcessError('Invalid Data URL', 'INVALID_DATA_URL', { cause, details: { kind } });
}

export function throwInvalidSvgDataURL(cause?: unknown): never {
  // 원본 오류는 cause에 보존해 호출자가 정확한 원인을 추적할 수 있게 한다.
  throw new ImageProcessError('Invalid SVG Data URL', 'INVALID_SVG_DATA_URL', { cause });
}
