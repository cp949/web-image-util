/**
 * deprecated File 변환 API가 파일명, MIME, 상세 metadata를 유지하는지 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { convertToFile, convertToFileDetailed } from '../../../src/utils/converters/file';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('File 변환 유틸', () => {
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

  it('convertToFile은 autoExtension이 false이면 원래 파일명을 유지한다', async () => {
    const canvas = createTestCanvas(80, 80, 'blue');

    const file = await convertToFile(canvas, 'avatar.png', {
      format: 'webp',
      autoExtension: false,
    });

    expect(file.name).toBe('avatar.png');
    expect(file.type).toBe('image/webp');
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
