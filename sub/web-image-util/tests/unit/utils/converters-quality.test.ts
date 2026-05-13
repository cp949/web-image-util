/**
 * Blob/File 입력 + 실제 디코딩이 필요한 quality 분기 동작을 검증한다.
 * Canvas 입력과 spy 미호출/동일성 분기는 `converters-quality-canvas.test.ts`(jsdom)에 있다.
 *
 * jsdom 환경에서는 production이 내부적으로 `createObjectURL(blob) + HTMLImageElement` 로드를
 * 거치는 경로가 실패하므로 happy-dom 환경에서 실행한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToDataURL, ensureBlob, ensureDataURL, ensureFile } from '../../../src/utils/converters';

describe('변환 유틸 quality 옵션 (Blob/File 입력 디코딩 경로)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('legacy 변환에서는 앞 공백이 있는 Data URL 문자열도 그대로 유지한다', async () => {
    const dataURL = '  data:image/png;base64,already-data-url';

    await expect(convertToDataURL(dataURL)).resolves.toBe(dataURL);
  });

  it('Blob을 Data URL로 보장 변환할 때 출력 옵션을 인코딩에 반영한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toDataURLSpy = vi.spyOn(canvasPrototype, 'toDataURL');

    await ensureDataURL(blob, { format: 'jpeg', quality: 0.95 });

    expect(toDataURLSpy).toHaveBeenLastCalledWith('image/jpeg', 0.95);
  });

  it('Blob을 Data URL로 보장 변환할 때 quality: 0을 그대로 전달한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toDataURLSpy = vi.spyOn(canvasPrototype, 'toDataURL');

    await ensureDataURL(blob, { format: 'webp', quality: 0 });

    expect(toDataURLSpy).toHaveBeenLastCalledWith('image/webp', 0);
  });

  it('quality가 명시되면 Blob 원본도 재인코딩한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    const result = await ensureBlob(blob, { format: 'png', quality: 0.5 });

    expect(result).not.toBe(blob);
    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/png', 0.5);
  });

  it('quality만 제공되면 Blob 원본 포맷을 유지한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/jpeg' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    const result = await ensureBlob(blob, { quality: 0.5 });

    expect(result).not.toBe(blob);
    expect(result.type).toBe('image/jpeg');
    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0.5);
  });

  it('파일명 또는 출력 옵션 변경이 필요하면 File을 새로 만든다', async () => {
    const file = new File(['mock'], 'image.png', { type: 'image/png' });

    const renamed = await ensureFile(file, 'renamed.png');
    const reencoded = await ensureFile(file, 'image.jpg', { format: 'jpeg', quality: 0.8 });

    expect(renamed).not.toBe(file);
    expect(renamed.name).toBe('renamed.png');
    expect(reencoded).not.toBe(file);
    expect(reencoded.name).toBe('image.jpeg');
    expect(reencoded.type).toBe('image/jpeg');
  });

  it('quality만 제공되면 File 원본 포맷을 유지한다', async () => {
    const file = new File(['mock'], 'image.jpg', { type: 'image/jpeg' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    const result = await ensureFile(file, 'image.jpg', { quality: 0.5 });

    expect(result).not.toBe(file);
    expect(result.name).toBe('image.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0.5);
  });

  it('File 출력 확장자는 공통 파일명 유틸 규칙을 따른다', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });

    const result = await ensureFile(blob, 'photo.png', { format: 'webp' });

    expect(result.name).toBe('photo.webp');
    expect(result.type).toBe('image/webp');
  });

  it('autoExtension이 false이면 원래 파일명을 유지한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });

    const result = await ensureFile(blob, 'photo.png', { format: 'jpeg', autoExtension: false });

    expect(result.name).toBe('photo.png');
    expect(result.type).toBe('image/jpeg');
  });
});
