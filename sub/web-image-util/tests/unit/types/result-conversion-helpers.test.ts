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
  drawToOwnedCanvas,
  loadImageFromUrl,
  withObjectUrl,
} from '../../../src/types/result-conversion-helpers.internal';
import { createTestCanvas } from '../../utils/canvas-helper';
import { createControlledImg, createRecordingCanvas, stubCreateElement } from './result-implementations.helpers';

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

  it('loadImageFromUrl: 전달한 URL을 img.src로 할당하고 load 후 element를 반환한다', async () => {
    const img = createControlledImg('load');
    stubCreateElement({ img });

    const element = await loadImageFromUrl('blob:some-url');

    expect(element).toBe(img);
    expect(element.src).toBe('blob:some-url');
  });

  it('loadImageFromUrl: 로드 실패 시 IMAGE_LOAD_FAILED로 거절한다', async () => {
    stubCreateElement({ img: createControlledImg('error') });

    await expect(loadImageFromUrl('blob:broken')).rejects.toMatchObject({ code: 'IMAGE_LOAD_FAILED' });
  });

  it('drawToOwnedCanvas: 지정한 크기의 canvas에 소스를 원점 정렬로 그린다', () => {
    const source = document.createElement('img');
    const { canvas, drawImage } = createRecordingCanvas();
    stubCreateElement({ canvas });

    const result = drawToOwnedCanvas(source, 320, 240);

    expect(result).toBe(canvas);
    expect(result.width).toBe(320);
    expect(result.height).toBe(240);
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0);
  });

  it('drawToOwnedCanvas: 2D context를 얻지 못하면 CANVAS_CREATION_FAILED로 던진다', () => {
    // stub 설치 전에 실제 요소를 만들어 둔다 — 설치 후에는 등록하지 않은 태그가 던진다
    const source = document.createElement('img');
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    stubCreateElement({ canvas });

    expect(() => drawToOwnedCanvas(source, 10, 10)).toThrowError(
      expect.objectContaining({ code: 'CANVAS_CREATION_FAILED' })
    );
  });

  it('withObjectUrl: use가 끝난 뒤 revoke하고 반환값을 그대로 전달한다', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:scoped');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    const received = await withObjectUrl(blob, async (objectUrl) => {
      // use 실행 중에는 아직 유효해야 한다
      expect(revokeSpy).not.toHaveBeenCalled();
      return `used:${objectUrl}`;
    });

    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(received).toBe('used:blob:scoped');
    expect(revokeSpy).toHaveBeenCalledWith('blob:scoped');
  });

  it('withObjectUrl: use가 거절해도 revoke하고 오류를 그대로 전파한다', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:scoped');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const failure = new Error('use 실패');

    await expect(withObjectUrl(blob, () => Promise.reject(failure))).rejects.toBe(failure);
    expect(revokeSpy).toHaveBeenCalledWith('blob:scoped');
  });
});
