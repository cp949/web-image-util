/**
 * URL.createObjectURL / URL.revokeObjectURL mock.
 *
 * @description Blob URL을 메모리 맵으로 흉내 낸다. 실제 브라우저의 라이프사이클은 보장하지 않는다.
 */

import { vi } from 'vitest';

if (typeof URL !== 'undefined') {
  const blobUrls = new Map<string, Blob>();
  let urlCounter = 0;

  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    const url = `blob:mock-${urlCounter++}`;
    if (blob instanceof Blob) {
      blobUrls.set(url, blob);
    }
    return url;
  }) as typeof URL.createObjectURL;

  URL.revokeObjectURL = vi.fn((url: string) => {
    blobUrls.delete(url);
  }) as typeof URL.revokeObjectURL;
}
