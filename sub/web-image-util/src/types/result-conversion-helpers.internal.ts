import { createOwnedCanvas, canvasToBlob as encodeCanvasToBlob } from '../base/canvas-utils.internal';
import { createImageElement } from '../utils/image-element.internal';
import { loadImageElement } from '../utils/image-loader.internal';
import type { OutputOptions } from './index';

/** format 미지정 시 기본 MIME으로 떨어지는 출력 MIME 결정. 이 모듈 안에서만 쓴다. */
function resolveOutputMimeType(options?: OutputOptions, defaultMimeType = 'image/png'): string {
  return options?.format ? `image/${options.format}` : defaultMimeType;
}

/**
 * result 객체용 canvas→Blob 변환.
 *
 * `defaultMimeType`은 format 미지정 시 사용할 기본 MIME이다(인코더의 재시도용
 * `fallbackMimeType`과 다름). 재시도 없이 1회 인코딩하며, 실패 시
 * CANVAS_TO_BLOB_FAILED로 reject한다.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  options?: OutputOptions,
  defaultMimeType = 'image/png'
): Promise<globalThis.Blob> {
  return encodeCanvasToBlob(canvas, {
    mimeType: resolveOutputMimeType(options, defaultMimeType),
    quality: options?.quality,
  });
}

export function canvasToDataURL(
  canvas: HTMLCanvasElement,
  options?: OutputOptions,
  defaultMimeType = 'image/png'
): string {
  return canvas.toDataURL(resolveOutputMimeType(options, defaultMimeType), options?.quality);
}

export function createFileFromBlob(blob: globalThis.Blob, filename: string): globalThis.File {
  return new File([blob], filename, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export async function blobToArrayBuffer(blob: globalThis.Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

export async function blobToUint8Array(blob: globalThis.Blob): Promise<Uint8Array> {
  const arrayBuffer = await blobToArrayBuffer(blob);
  return new Uint8Array(arrayBuffer);
}

/**
 * URL에서 HTMLImageElement를 로드한다.
 *
 * data URL · object URL · 일반 URL을 모두 받는다. 로드 실패 시
 * IMAGE_LOAD_FAILED로 reject한다.
 */
export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const img = createImageElement();
  await loadImageElement(img, url);
  return img;
}

/**
 * 이미 로드된 이미지 소스를 호출자 소유 canvas에 원점 정렬로 그린다.
 *
 * 결과 canvas는 호출자에게 넘기므로 Canvas Pool로 반환하지 않는다.
 * `width`/`height`는 결과 객체가 이미 알고 있는 크기를 그대로 쓴다.
 */
export function drawToOwnedCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const { canvas, ctx } = createOwnedCanvas(width, height);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

/**
 * blob의 object URL을 만들어 `use`에 넘기고, 성공·실패와 무관하게 revoke한다.
 *
 * `use`가 반환한 Promise가 결정된 뒤에 revoke하므로, URL이 유효한 동안
 * 이미지 로드와 drawImage를 모두 끝낼 수 있다.
 */
export async function withObjectUrl<T>(blob: globalThis.Blob, use: (objectUrl: string) => Promise<T>): Promise<T> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await use(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
