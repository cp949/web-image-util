import { ImageProcessError } from '../errors.internal';

export function createCanvasContextError(operation: string): ImageProcessError {
  return new ImageProcessError('Failed to get Canvas 2D context', 'CANVAS_CONTEXT_FAILED', {
    details: { operation },
  });
}

/**
 * 반복 패턴의 타일 간격이 유한 양수인지 확인한다.
 *
 * 0 이하이거나 NaN/Infinity면 타일 루프가 전진하지 않거나 끝나지 않아 브라우저가 멈추므로
 * 그리기 전에 거른다. 텍스트·이미지 반복 패턴이 같은 루프 형태를 쓰므로 검증도 한 곳에서 한다.
 *
 * `details`에 `minimum`은 넣지 않는다 — compose.ts의 옵션 검증 관례상 `minimum`은 포함 하한을
 * 뜻하는데(`columns >= 1` → `minimum: 1`), 여기서 0은 거부 대상이라 `minimum: 0`은 오해를 부른다.
 */
export function requirePositiveSpacing(value: number, option: string, context: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ImageProcessError(`${context}: ${option} must be a positive number`, 'OPTION_INVALID', {
      details: { option },
    });
  }
}
