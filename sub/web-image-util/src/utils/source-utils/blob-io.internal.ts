/**
 * Blob 본문 읽기 ponyfill.
 *
 * `Blob.prototype.text()`/`.arrayBuffer()`는 Chrome 76부터 지원된다 — 이 저장소의
 * 빌드 하한선인 Chrome 75(ADR-0001)보다 위다. Chrome 75에서 두 메서드를 가드 없이
 * 호출하면 `blob.text is not a function`으로 즉시 크래시한다.
 *
 * 라이브러리 전체에서 Blob 본문을 읽는 지점은 이 모듈의 두 함수만 거쳐야 한다.
 * 네이티브 메서드가 있으면 그대로 쓰고, 없으면 FileReader로 폴백한다.
 */

import { ImageProcessError } from '../../errors.internal';

/**
 * Blob 본문을 텍스트로 읽는다.
 *
 * 네이티브 `blob.text()`가 있으면 그대로 사용하고, 없으면(Chrome75 이하)
 * `FileReader.readAsText`로 폴백한다.
 */
export function readBlobAsText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageProcessError('Blob to text conversion failed', 'BLOB_CONVERSION_ERROR'));
    reader.readAsText(blob);
  });
}

/**
 * Blob 본문을 ArrayBuffer로 읽는다.
 *
 * 네이티브 `blob.arrayBuffer()`가 있으면 그대로 사용하고, 없으면(Chrome75 이하)
 * `FileReader.readAsArrayBuffer`로 폴백한다.
 */
export function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(new ImageProcessError('Blob to ArrayBuffer conversion failed', 'BLOB_CONVERSION_ERROR'));
    reader.readAsArrayBuffer(blob);
  });
}
