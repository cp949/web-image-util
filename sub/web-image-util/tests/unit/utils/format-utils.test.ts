import { describe, expect, it } from 'vitest';
import {
  formatToMimeType,
  getOutputFilename,
  isSupportedOutputFormat,
  mimeTypeToImageFormat,
  mimeTypeToOutputFormat,
  replaceImageExtension,
  resolveOutputFormat,
} from '../../../src';
// outputFormatFromFilename은 공개 표면이 아니라 내부 소비자(output-pipeline)용이므로 모듈에서 직접 가져온다.
import { outputFormatFromFilename } from '../../../src/utils/format-utils';

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
    expect(replaceImageExtension('photo.backup?x=1', 'avif')).toBe('photo.avif');
    expect(replaceImageExtension('images/nested/photo.png#preview', 'webp')).toBe('images/nested/photo.webp');
  });

  it('확장자가 없으면 권장 확장자를 덧붙인다', () => {
    expect(replaceImageExtension('photo', 'png')).toBe('photo.png');
    // JPEG 계열의 권장 확장자는 jpg다
    expect(replaceImageExtension('photo', 'jpeg')).toBe('photo.jpg');
  });

  it('JPEG 계열은 권장 확장자 jpg로 통일한다', () => {
    expect(replaceImageExtension('photo.png', 'jpeg')).toBe('photo.jpg');
    expect(replaceImageExtension('photo.png', 'jpg')).toBe('photo.jpg');
  });

  it('확장자가 이미 같은 포맷을 가리키면 표기를 보존한다', () => {
    // .jpeg와 .jpg 모두 jpeg 포맷이므로 사용자가 쓴 표기를 바꾸지 않는다
    expect(replaceImageExtension('photo.jpeg', 'jpeg')).toBe('photo.jpeg');
    expect(replaceImageExtension('photo.jpg', 'jpeg')).toBe('photo.jpg');
    expect(replaceImageExtension('photo.JPG', 'jpeg')).toBe('photo.JPG');
    expect(replaceImageExtension('photo.png', 'png')).toBe('photo.png');
  });

  it('이미지 확장자가 아니어도 마지막 확장자를 교체한다', () => {
    expect(replaceImageExtension('photo.txt', 'png')).toBe('photo.png');
    // gif·svg는 Canvas 출력 포맷이 아니므로 보존 대상이 아니다
    expect(replaceImageExtension('photo.gif', 'png')).toBe('photo.png');
  });

  it('디렉터리 구분자 뒤 첫 점은 확장자로 보지 않는다', () => {
    expect(replaceImageExtension('.hidden', 'png')).toBe('.hidden.png');
    expect(replaceImageExtension('dir/.hidden', 'png')).toBe('dir/.hidden.png');
  });

  it('파일명 확장자에서 출력 포맷을 판정한다', () => {
    expect(outputFormatFromFilename('photo.png')).toBe('png');
    expect(outputFormatFromFilename('photo.JPG')).toBe('jpeg');
    expect(outputFormatFromFilename('photo.jpeg')).toBe('jpeg');
    expect(outputFormatFromFilename('photo.png?v=1')).toBe('png');
    // Canvas 출력 포맷이 아닌 확장자와 확장자 없는 파일명
    expect(outputFormatFromFilename('photo.gif')).toBeUndefined();
    expect(outputFormatFromFilename('photo.bin')).toBeUndefined();
    expect(outputFormatFromFilename('photo')).toBeUndefined();
    // 디렉터리에 점이 있고 파일명에는 확장자가 없는 경우
    expect(outputFormatFromFilename('a.b/photo')).toBeUndefined();
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
