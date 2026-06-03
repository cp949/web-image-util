/**
 * Result 구현체가 공유하는 Canvas/Blob/File 변환 헬퍼를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blobToArrayBuffer,
  blobToUint8Array,
  canvasToBlob,
  canvasToDataURL,
  createFileFromBlob,
} from '../../../src/types/result-conversion-helpers.internal';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('result 변환 내부 헬퍼', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canvasToBlob: format·quality 옵션을 canvas.toBlob에 전달한다', async () => {
    const canvas = createTestCanvas(20, 20, 'red');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob(['encoded'], { type: type ?? '' }));
    });

    const blob = await canvasToBlob(canvas, { format: 'jpeg', quality: 0.85 });

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
    expect(blob.type).toBe('image/jpeg');
  });

  it('canvasToBlob: format이 없으면 fallback MIME 타입을 사용한다', async () => {
    const canvas = createTestCanvas(20, 20, 'blue');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob(['encoded'], { type: type ?? '' }));
    });

    const blob = await canvasToBlob(canvas, { quality: 0.7 }, 'image/webp');

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.7);
    expect(blob.type).toBe('image/webp');
  });

  it('canvasToBlob: toBlob 콜백이 null이면 CANVAS_TO_BLOB_FAILED로 거절한다', async () => {
    const canvas = createTestCanvas(20, 20, 'green');
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
      callback(null);
    });

    await expect(canvasToBlob(canvas)).rejects.toMatchObject({ code: 'CANVAS_TO_BLOB_FAILED' });
  });

  it('canvasToDataURL: MIME 타입과 quality를 canvas.toDataURL에 전달한다', () => {
    const canvas = createTestCanvas(20, 20, 'red');
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/webp;base64,mock');

    const dataURL = canvasToDataURL(canvas, { format: 'webp', quality: 0.8 });

    expect(toDataURLSpy).toHaveBeenCalledWith('image/webp', 0.8);
    expect(dataURL).toBe('data:image/webp;base64,mock');
  });

  it('createFileFromBlob: blob type과 파일명을 File에 전파한다', () => {
    const blob = new Blob(['payload'], { type: 'image/png' });

    const file = createFileFromBlob(blob, 'output.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.png');
    expect(file.type).toBe('image/png');
  });

  it('blobToArrayBuffer: Blob 내용을 ArrayBuffer로 변환한다', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });

    const arrayBuffer = await blobToArrayBuffer(blob);

    expect(Array.from(new Uint8Array(arrayBuffer))).toEqual([1, 2, 3]);
  });

  it('blobToUint8Array: Blob 내용을 Uint8Array로 변환한다', async () => {
    const blob = new Blob([new Uint8Array([4, 5, 6])], { type: 'application/octet-stream' });

    const bytes = await blobToUint8Array(blob);

    expect(Array.from(bytes)).toEqual([4, 5, 6]);
  });
});
