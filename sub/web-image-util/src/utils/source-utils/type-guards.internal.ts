/**
 * 비문자열 이미지 소스의 타입 가드.
 *
 * `instanceof`가 사용 가능한 환경에서는 그것을, 그렇지 않은 환경(테스트 더블 등)에서는
 * 형태(shape) 기반으로 판정한다.
 */

/** 입력이 `HTMLImageElement` 또는 그에 호환되는 객체인지 판정한다. */
export function isImageElementSource(source: unknown): source is HTMLImageElement {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return true;
  }

  return isObject(source) && getTagName(source) === 'IMG';
}

/** 입력이 `HTMLCanvasElement` 또는 그에 호환되는 객체인지 판정한다. */
export function isCanvasElementSource(source: unknown): source is HTMLCanvasElement {
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return true;
  }

  return (
    isObject(source) &&
    getTagName(source) === 'CANVAS' &&
    'getContext' in source &&
    typeof source.getContext === 'function' &&
    'toDataURL' in source &&
    typeof source.toDataURL === 'function'
  );
}

/** 입력이 `Blob` 또는 그에 호환되는 객체인지 판정한다. */
export function isBlobSource(source: unknown): source is Blob {
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return true;
  }

  return (
    isObject(source) &&
    'type' in source &&
    typeof source.type === 'string' &&
    'size' in source &&
    typeof source.size === 'number' &&
    ('slice' in source || 'arrayBuffer' in source)
  );
}

/** Blob 슬라이스가 `text()`를 노출해 안전하게 본문을 읽을 수 있는지 확인한다. */
export function canReadBlobText(blob: Blob): boolean {
  return typeof blob.slice === 'function' && typeof blob.slice(0, 0).text === 'function';
}

/** 객체에서 `tagName`을 안전하게 대문자로 추출한다. */
export function getTagName(source: object): string {
  return 'tagName' in source && typeof source.tagName === 'string' ? source.tagName.toUpperCase() : '';
}

/** 입력이 비-null 객체인지 판정한다. */
export function isObject(source: unknown): source is Record<string, unknown> {
  return typeof source === 'object' && source !== null;
}
