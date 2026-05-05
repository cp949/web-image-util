import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertToBlob,
  convertToDataURL,
  ensureBlob,
  ensureDataURL,
  ensureFile,
  isDataURLString,
} from '../../../src/utils/converters';

describe('변환 유틸 quality 옵션', () => {
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

  it('legacy 변환에서는 앞 공백이 있는 Data URL 문자열도 그대로 유지한다', async () => {
    const dataURL = '  data:image/png;base64,already-data-url';

    await expect(convertToDataURL(dataURL)).resolves.toBe(dataURL);
  });

  it('convertToBlob은 quality만 제공된 Blob을 재인코딩하지 않는다', async () => {
    const blob = new Blob(['mock'], { type: 'image/jpeg' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    await expect(convertToBlob(blob, { quality: 0.5 })).resolves.toBe(blob);
    expect(toBlobSpy).not.toHaveBeenCalled();
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

  it('Blob 출력에 재인코딩이 필요 없으면 원본 Blob을 재사용한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });

    await expect(ensureBlob(blob)).resolves.toBe(blob);
    await expect(ensureBlob(blob, { format: 'png' })).resolves.toBe(blob);
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

  it('파일명과 출력 옵션 변경이 필요 없으면 원본 File을 재사용한다', async () => {
    const file = new File(['mock'], 'image.png', { type: 'image/png' });

    await expect(ensureFile(file, 'image.png', { format: 'png' })).resolves.toBe(file);
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
