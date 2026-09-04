import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBlobAsArrayBuffer, readBlobAsText } from '../../../../src/utils/source-utils/blob-io.internal';

/** blob 인스턴스의 네이티브 메서드를 일시적으로 숨겨 Chrome75(폴백) 경로를 강제한다. */
function hideNativeMethod<K extends 'text' | 'arrayBuffer'>(blob: Blob, method: K): void {
  Object.defineProperty(blob, method, { value: undefined, configurable: true });
}

/** onload/onerror 호출 시점을 테스트가 직접 통제할 수 있는 FileReader 스텁이다. */
class FailingFileReader {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsText(): void {
    queueMicrotask(() => this.onerror?.());
  }

  readAsArrayBuffer(): void {
    queueMicrotask(() => this.onerror?.());
  }
}

describe('readBlobAsText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('네이티브 blob.text()가 있으면 그것을 사용한다', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const nativeText = vi.spyOn(blob, 'text');

    await expect(readBlobAsText(blob)).resolves.toBe('hello');
    expect(nativeText).toHaveBeenCalledTimes(1);
  });

  it('네이티브 blob.text()가 없으면 FileReader.readAsText로 폴백한다', async () => {
    const blob = new Blob(['fallback-text'], { type: 'text/plain' });
    hideNativeMethod(blob, 'text');

    await expect(readBlobAsText(blob)).resolves.toBe('fallback-text');
  });

  it('FileReader 폴백이 실패하면 reject한다', async () => {
    const blob = new Blob(['irrelevant'], { type: 'text/plain' });
    hideNativeMethod(blob, 'text');

    const OriginalFileReader = globalThis.FileReader;
    globalThis.FileReader = FailingFileReader as unknown as typeof FileReader;
    try {
      await expect(readBlobAsText(blob)).rejects.toThrow('Blob to text conversion failed');
    } finally {
      globalThis.FileReader = OriginalFileReader;
    }
  });
});

describe('readBlobAsArrayBuffer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('네이티브 blob.arrayBuffer()가 있으면 그것을 사용한다', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const nativeArrayBuffer = vi.spyOn(blob, 'arrayBuffer');

    const buffer = await readBlobAsArrayBuffer(blob);
    expect(new TextDecoder().decode(buffer)).toBe('hello');
    expect(nativeArrayBuffer).toHaveBeenCalledTimes(1);
  });

  it('네이티브 blob.arrayBuffer()가 없으면 FileReader.readAsArrayBuffer로 폴백한다', async () => {
    const blob = new Blob(['fallback-buffer'], { type: 'text/plain' });
    hideNativeMethod(blob, 'arrayBuffer');

    const buffer = await readBlobAsArrayBuffer(blob);
    expect(new TextDecoder().decode(buffer)).toBe('fallback-buffer');
  });

  it('FileReader 폴백이 실패하면 reject한다', async () => {
    const blob = new Blob(['irrelevant'], { type: 'text/plain' });
    hideNativeMethod(blob, 'arrayBuffer');

    const OriginalFileReader = globalThis.FileReader;
    globalThis.FileReader = FailingFileReader as unknown as typeof FileReader;
    try {
      await expect(readBlobAsArrayBuffer(blob)).rejects.toThrow('Blob to ArrayBuffer conversion failed');
    } finally {
      globalThis.FileReader = OriginalFileReader;
    }
  });
});
