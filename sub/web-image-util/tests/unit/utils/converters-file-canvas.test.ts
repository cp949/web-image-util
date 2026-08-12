/**
 * Canvas 입력으로 ensure* File 변환 API의 파일명/MIME/metadata 동작을 검증한다.
 * Blob 입력 + webp 같은 jsdom 미지원 포맷 케이스는 browser 스모크에서 다룬다.
 */

import { describe, expect, it } from 'vitest';
import { ensureFile, ensureFileDetailed } from '../../../src/utils/converters/ensure.internal';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('File 변환 유틸 (jsdom-safe)', () => {
  it('ensureFile은 요청 포맷에 맞춰 확장자와 MIME을 조정한다', async () => {
    const canvas = createTestCanvas(120, 80, 'red');

    const file = await ensureFile(canvas, 'sample.png', {
      format: 'jpeg',
      quality: 0.7,
      autoExtension: true,
    });

    expect(file).toBeInstanceOf(File);
    // JPEG 계열의 권장 확장자는 jpg다 — toFile()과 같은 정책 정본을 쓴다
    expect(file.name).toBe('sample.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(file.size).toBeGreaterThan(0);
  });

  it('ensureFile은 확장자가 이미 같은 포맷을 가리키면 원본 File을 재사용한다', async () => {
    const file = new File(['mock'], 'photo.jpg', { type: 'image/jpeg' });

    // 확장자 표기(.jpg)가 보존되므로 파일명이 바뀌지 않고 재인코딩도 일어나지 않는다
    await expect(ensureFile(file, 'photo.jpg', { format: 'jpeg' })).resolves.toBe(file);
  });

  it('ensureFileDetailed은 파일과 치수 metadata를 함께 반환한다', async () => {
    const canvas = createTestCanvas(160, 90, 'green');

    const result = await ensureFileDetailed(canvas, 'hero.png', {
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
