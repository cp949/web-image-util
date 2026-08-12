import { describe, expect, it } from 'vitest';
import {
  formatToMimeType,
  getOutputFilename,
  isSupportedOutputFormat,
  mimeTypeToImageFormat,
  mimeTypeToOutputFormat,
  replaceImageExtension,
  resolveOutputFormat,
} from '../../../src/utils';

describe('포맷 유틸', () => {
  it('이미지 포맷을 MIME 타입으로 변환한다', () => {
    expect(formatToMimeType('jpg')).toBe('image/jpeg');
    expect(formatToMimeType('jpeg')).toBe('image/jpeg');
    expect(formatToMimeType('png')).toBe('image/png');
    expect(formatToMimeType('webp')).toBe('image/webp');
    expect(formatToMimeType('avif')).toBe('image/avif');
    expect(formatToMimeType('svg')).toBe('image/svg+xml');
  });

  it('MIME 타입을 이미지 포맷으로 변환한다', () => {
    expect(mimeTypeToImageFormat('image/jpeg')).toBe('jpeg');
    expect(mimeTypeToImageFormat('IMAGE/JPEG')).toBe('jpeg');
    expect(mimeTypeToImageFormat('image/svg+xml; charset=utf-8')).toBe('svg');
    expect(mimeTypeToImageFormat('application/octet-stream')).toBe('unknown');
  });

  it('MIME 타입을 Canvas 출력 가능한 포맷으로 변환한다', () => {
    expect(mimeTypeToOutputFormat('image/jpeg')).toBe('jpeg');
    expect(mimeTypeToOutputFormat('image/png')).toBe('png');
    expect(mimeTypeToOutputFormat('image/gif')).toBeUndefined();
    expect(mimeTypeToOutputFormat('image/svg+xml')).toBeUndefined();
  });

  it('파일 확장자를 출력 포맷에 맞게 교체한다', () => {
    expect(replaceImageExtension('photo.png', 'webp')).toBe('photo.webp');
    expect(replaceImageExtension('archive.photo.old.jpg', 'png')).toBe('archive.photo.old.png');
    expect(replaceImageExtension('photo', 'jpeg')).toBe('photo.jpeg');
    expect(replaceImageExtension('photo.backup?x=1', 'avif')).toBe('photo.avif');
    expect(replaceImageExtension('images/nested/photo.png#preview', 'webp')).toBe('images/nested/photo.webp');
  });

  it('출력 옵션을 반영한 최종 파일명을 계산한다', () => {
    expect(getOutputFilename('photo.png', { format: 'webp' })).toBe('photo.webp');
    expect(getOutputFilename('photo.png', { format: 'webp', autoExtension: false })).toBe('photo.png');
    expect(getOutputFilename('photo.png', {})).toBe('photo.png');
  });

  it('Canvas 출력 포맷 여부를 판정한다', () => {
    expect(isSupportedOutputFormat('jpeg')).toBe(true);
    expect(isSupportedOutputFormat('jpg')).toBe(true);
    expect(isSupportedOutputFormat('png')).toBe(true);
    expect(isSupportedOutputFormat('webp')).toBe(true);
    expect(isSupportedOutputFormat('avif')).toBe(true);
    expect(isSupportedOutputFormat('gif')).toBe(false);
    expect(isSupportedOutputFormat('svg')).toBe(false);
  });

  it('선호 포맷과 지원 목록을 기준으로 출력 포맷을 결정한다', () => {
    expect(resolveOutputFormat('avif', { supported: ['webp', 'png'] })).toBe('webp');
    expect(resolveOutputFormat('webp', { supported: ['png'], fallback: 'jpeg' })).toBe('png');
    expect(resolveOutputFormat('png', { supported: ['png'] })).toBe('png');
    expect(resolveOutputFormat('webp', { supported: ['avif'], fallback: 'jpeg' })).toBe('png');
  });
});
