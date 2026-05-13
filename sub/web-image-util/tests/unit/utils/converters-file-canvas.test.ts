/**
 * Canvas 입력으로 deprecated File 변환 API의 파일명/MIME/metadata 동작을 검증한다.
 * Blob 입력 + webp 같은 jsdom 미지원 포맷 케이스는 `converters-file.test.ts`(happy-dom)에서 다룬다.
 */

import { describe, expect, it } from 'vitest';
import { convertToFile, convertToFileDetailed } from '../../../src/utils/converters/file';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('File 변환 유틸 (jsdom-safe)', () => {
  it('convertToFile은 요청 포맷에 맞춰 확장자와 MIME을 조정한다', async () => {
    const canvas = createTestCanvas(120, 80, 'red');

    const file = await convertToFile(canvas, 'sample.png', {
      format: 'jpeg',
      quality: 0.7,
      autoExtension: true,
    });

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('sample.jpeg');
    expect(file.type).toBe('image/jpeg');
    expect(file.size).toBeGreaterThan(0);
  });

  it('convertToFileDetailed은 파일과 치수 metadata를 함께 반환한다', async () => {
    const canvas = createTestCanvas(160, 90, 'green');

    const result = await convertToFileDetailed(canvas, 'hero.png', {
      format: 'png',
    });

    expect(result.file).toBeInstanceOf(File);
    expect(result.file.name).toBe('hero.png');
    expect(result.file.type).toBe('image/png');
    expect(result.width).toBe(160);
    expect(result.height).toBe(90);
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });
});
