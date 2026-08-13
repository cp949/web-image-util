/**
 * HTMLImageElement 디코드를 단일 소유하는 모듈이다.
 *
 * 담당 범위는 img 생성, `src` 할당 전 속성 설정, objectURL 수명, 실패의 도메인 오류 래핑이다.
 * img를 로드 완료 상태까지 구동하는 방식만 어댑터로 갈라진다 — 테스트는 브라우저 디코드 대신
 * 즉시 결정되는 어댑터를 끼워 실제 디코딩 없이 호출처를 구동한다.
 *
 * 오류 코드와 메시지는 호출자가 주입한다. 어댑터는 실패 원인만 던지고 오류 조립에는 관여하지
 * 않으므로, 어댑터를 바꿔도 호출처가 관찰하는 오류 계약이 갈리지 않는다.
 */

import type { ImageErrorCodeType } from '../types';
import { ImageProcessError } from '../types';
import { createImageElement } from './image-element.internal';

/** 디코드 실패를 도메인 오류로 조립할 때 쓰는 옵션이다. */
export interface ImageDecodeOptions {
  /**
   * 로드 실패 시 던질 오류 코드. **기본값을 두지 않는다** — 기본값이 있으면 새 호출자가
   * 인자를 빠뜨렸을 때 오류 코드가 조용히 다른 값으로 떨어진다. 필수로 두면 컴파일 타임에 드러난다.
   */
  errorCode: ImageErrorCodeType;
  /** 로드 실패 메시지. 생략 시 'Image loading failed'. */
  message?: string;
  crossOrigin?: string;
  decoding?: 'async' | 'sync' | 'auto';
  /** createObjectURL 실패 시 쓸 코드. 생략 시 `errorCode`. */
  objectUrlErrorCode?: ImageErrorCodeType;
  /** createObjectURL 실패 메시지. 생략 시 `message`. */
  objectUrlMessage?: string;
}

/**
 * img를 로드 완료 상태까지 구동하는 유일한 책임을 갖는다.
 *
 * `src`가 `undefined`면 이미 소스가 붙은 element의 완료만 기다린다. 재할당은 진행 중인
 * 로드를 다시 시작시키므로 기존 element 경로에서는 넘기지 않는다.
 */
export interface ImageDecodeAdapter {
  decode(img: HTMLImageElement, src?: string): Promise<void>;
}

const DEFAULT_DECODE_MESSAGE = 'Image loading failed';

/** 브라우저 디코드 어댑터다. 핸들러 등록·해제 규칙의 단일 출처다. */
const browserImageDecodeAdapter: ImageDecodeAdapter = {
  decode(img, src) {
    return new Promise<void>((resolve, reject) => {
      // 결정 시점에 핸들러를 해제해 element가 살아 있어도 참조가 남지 않게 한다.
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        cleanup();
        resolve();
      };

      img.onerror = () => {
        cleanup();
        reject(new Error(DEFAULT_DECODE_MESSAGE));
      };

      if (src !== undefined) {
        img.src = src;
      }
    });
  },
};

let activeAdapter: ImageDecodeAdapter = browserImageDecodeAdapter;

/** 테스트가 디코드 구동 방식을 대체할 때 쓰는 진입점이다. 공개 표면에 노출하지 않는다. */
export function setImageDecodeAdapter(adapter: ImageDecodeAdapter): void {
  activeAdapter = adapter;
}

/** 기본 브라우저 어댑터로 되돌린다. */
export function resetImageDecodeAdapter(): void {
  activeAdapter = browserImageDecodeAdapter;
}

/** `src` 할당 전에 설정해야 실제로 반영되는 속성들이다. */
function applyDecodeAttributes(img: HTMLImageElement, options: ImageDecodeOptions): void {
  if (options.crossOrigin) {
    img.crossOrigin = options.crossOrigin;
  }
  if (options.decoding) {
    img.decoding = options.decoding;
  }
}

/**
 * 어댑터로 img를 구동하고 실패를 호출자가 주입한 오류로 바꾼다.
 *
 * 호출처가 핸들러 등록 전에 이벤트를 발화시키지 못하도록 어댑터 호출까지는 동기로 진행한다.
 */
async function driveDecode(
  img: HTMLImageElement,
  src: string | undefined,
  options: ImageDecodeOptions
): Promise<HTMLImageElement> {
  applyDecodeAttributes(img, options);

  try {
    await activeAdapter.decode(img, src);
  } catch (cause) {
    throw new ImageProcessError(options.message ?? DEFAULT_DECODE_MESSAGE, options.errorCode, { cause });
  }

  return img;
}

/** URL에서 이미지를 디코드한다. data URL·object URL·일반 URL을 모두 받는다. */
export function decodeImageFromUrl(src: string, options: ImageDecodeOptions): Promise<HTMLImageElement> {
  return driveDecode(createImageElement(), src, options);
}

/**
 * Blob을 objectURL로 올려 디코드한다.
 *
 * objectURL은 성공·실패와 무관하게 revoke한다.
 */
export async function decodeImageFromBlob(blob: Blob, options: ImageDecodeOptions): Promise<HTMLImageElement> {
  let objectUrl: string;
  try {
    objectUrl = URL.createObjectURL(blob);
  } catch (cause) {
    throw new ImageProcessError(
      options.objectUrlMessage ?? options.message ?? DEFAULT_DECODE_MESSAGE,
      options.objectUrlErrorCode ?? options.errorCode,
      { cause }
    );
  }

  try {
    return await decodeImageFromUrl(objectUrl, options);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 이미 소스가 붙은 element의 로드 완료를 기다린다.
 *
 * 로드가 끝난 element에는 핸들러를 붙이지 않는다.
 *
 * 옵션을 `errorCode`·`message`로 좁힌다. `crossOrigin`은 img의 relevant mutation이라
 * 할당하면 "이미지 데이터 갱신"이 다시 큐잉되어, 호출자가 소유한 element에서 이미 진행 중인
 * 로드를 재시작시킨다. 호출 표면을 두 필드로 좁혀 객체 리터럴에 `crossOrigin`을 잘못 넘기면
 * 초과 속성 오류로 드러나게 한다. 구조적 타입으로 미리 선언한 넓은 옵션까지 차단하지는 않는다.
 */
export function decodeExistingImage(
  img: HTMLImageElement,
  options: Pick<ImageDecodeOptions, 'errorCode' | 'message'>
): Promise<HTMLImageElement> {
  if (img.complete && img.naturalWidth > 0) {
    return Promise.resolve(img);
  }

  return driveDecode(img, undefined, options);
}
