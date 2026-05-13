/**
 * Canvas 입력과 재인코딩이 필요 없는 분기(spy 미호출, 동일성 재사용)만 검증한다.
 * Blob/File 입력 + 실제 디코딩 흐름은 별도 파일(`converters-quality.test.ts`)에서 다룬다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertToBlob,
  convertToDataURL,
  ensureBlob,
  ensureDataURL,
  ensureFile,
  isDataURLString,
} from '../../../src/utils/converters';

describe('변환 유틸 quality 옵션 (jsdom-safe)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Canvas를 Blob으로 변환할 때 quality: 0을 그대로 전달한다', async () => {
    const canvas = document.createElement('canvas');
    const canvasPrototype = Object.getPrototypeOf(canvas) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    await convertToBlob(canvas, { format: 'jpeg', quality: 0 });

    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0);
  });

  it('Canvas를 Data URL로 변환할 때 quality: 0을 그대로 전달한다', async () => {
    const canvas = document.createElement('canvas');
    const canvasPrototype = Object.getPrototypeOf(canvas) as HTMLCanvasElement;
    const toDataURLSpy = vi.spyOn(canvasPrototype, 'toDataURL');

    await convertToDataURL(canvas, { format: 'webp', quality: 0 });

    expect(toDataURLSpy).toHaveBeenLastCalledWith('image/webp', 0);
  });

  it('Data URL 문자열 여부를 판정한다', () => {
    expect(isDataURLString('data:image/png;base64,abc')).toBe(true);
    expect(isDataURLString('https://example.com/image.png')).toBe(false);
    expect(isDataURLString('<svg viewBox="0 0 1 1"></svg>')).toBe(false);
    expect(isDataURLString(null)).toBe(false);
  });

  it('출력 옵션이 있어도 기존 Data URL 문자열은 그대로 재사용한다', async () => {
    const dataURL = 'data:image/png;base64,already-data-url';

    await expect(ensureDataURL(dataURL, { format: 'jpeg', quality: 0.95 })).resolves.toBe(dataURL);
  });

  it('convertToBlob은 quality만 제공된 Blob을 재인코딩하지 않는다', async () => {
    const blob = new Blob(['mock'], { type: 'image/jpeg' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    await expect(convertToBlob(blob, { quality: 0.5 })).resolves.toBe(blob);
    expect(toBlobSpy).not.toHaveBeenCalled();
  });

  it('Blob 출력에 재인코딩이 필요 없으면 원본 Blob을 재사용한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });

    await expect(ensureBlob(blob)).resolves.toBe(blob);
    await expect(ensureBlob(blob, { format: 'png' })).resolves.toBe(blob);
  });

  it('파일명과 출력 옵션 변경이 필요 없으면 원본 File을 재사용한다', async () => {
    const file = new File(['mock'], 'image.png', { type: 'image/png' });

    await expect(ensureFile(file, 'image.png', { format: 'png' })).resolves.toBe(file);
  });
});
