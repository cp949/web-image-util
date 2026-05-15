/**
 * 5개 Result 구현 클래스의 속성 노출과 no-option 변환 경로를 단정한다.
 *
 * 옵션 있는 변환(재인코딩)은 ensure-detailed-results.test.ts가 담당하므로 중복하지 않는다.
 * jsdom canvas 인코딩이 필요 없는 순수 동작 경로(blob/file 동일 참조 반환)만 검증한다.
 */

import { describe, expect, it } from 'vitest';
import {
  BlobResultImpl,
  CanvasResultImpl,
  DataURLResultImpl,
  ElementResultImpl,
  FileResultImpl,
} from '../../../src/types/result-implementations';
import { createTestCanvas } from '../../utils/canvas-helper';

// ─── DataURLResultImpl ────────────────────────────────────────────────────

describe('DataURLResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 320, 240, 12, { width: 640, height: 480 }, 'png');

    expect(impl.dataURL).toBe('data:image/png;base64,abc');
    expect(impl.width).toBe(320);
    expect(impl.height).toBe(240);
    expect(impl.processingTime).toBe(12);
    expect(impl.originalSize).toEqual({ width: 640, height: 480 });
    expect(impl.format).toBe('png');
  });

  it('선택 인자(originalSize, format) 없이 생성하면 undefined다', () => {
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 100, 100, 5);

    expect(impl.originalSize).toBeUndefined();
    expect(impl.format).toBeUndefined();
  });
});

// ─── BlobResultImpl ───────────────────────────────────────────────────────

describe('BlobResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const blob = new Blob(['mock'], { type: 'image/jpeg' });
    const impl = new BlobResultImpl(blob, 800, 600, 20, { width: 1600, height: 1200 }, 'jpeg');

    expect(impl.blob).toBe(blob);
    expect(impl.width).toBe(800);
    expect(impl.height).toBe(600);
    expect(impl.processingTime).toBe(20);
    expect(impl.originalSize).toEqual({ width: 1600, height: 1200 });
    expect(impl.format).toBe('jpeg');
  });
});

describe('BlobResultImpl no-option 경로', () => {
  it('toBlob() 옵션 없음 → 기존 blob 인스턴스 그대로 반환(재인코딩 없음)', async () => {
    const original = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(original, 100, 100, 0);

    const result = await impl.toBlob();

    // 동일 참조여야 한다 — canvas 경유 재인코딩이 발생하면 다른 인스턴스다
    expect(result).toBe(original);
  });

  it('toFile() 옵션 없음 → 기존 blob을 래핑한 File 반환(canvas 경유 없음)', async () => {
    const original = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(original, 100, 100, 0);

    const file = await impl.toFile('output.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.png');
    // type은 원본 blob.type을 그대로 사용한다
    expect(file.type).toBe('image/png');
  });
});

// ─── FileResultImpl ───────────────────────────────────────────────────────

describe('FileResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
    const impl = new FileResultImpl(file, 400, 300, 8, undefined, 'jpeg');

    expect(impl.file).toBe(file);
    expect(impl.width).toBe(400);
    expect(impl.height).toBe(300);
    expect(impl.processingTime).toBe(8);
    expect(impl.originalSize).toBeUndefined();
    expect(impl.format).toBe('jpeg');
  });
});

describe('FileResultImpl no-option 경로', () => {
  it('toBlob() 옵션 없음 → 기존 File 인스턴스 그대로 반환(File은 Blob의 서브클래스)', async () => {
    const file = new File(['data'], 'img.png', { type: 'image/png' });
    const impl = new FileResultImpl(file, 100, 100, 0);

    const result = await impl.toBlob();

    // File은 Blob 서브클래스이므로 원본 file 참조여야 한다
    expect(result).toBe(file);
  });
});

// ─── CanvasResultImpl ─────────────────────────────────────────────────────

describe('CanvasResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const canvas = createTestCanvas(200, 150, 'green');
    const impl = new CanvasResultImpl(canvas, 200, 150, 15, { width: 400, height: 300 }, 'webp');

    expect(impl.canvas).toBe(canvas);
    expect(impl.width).toBe(200);
    expect(impl.height).toBe(150);
    expect(impl.processingTime).toBe(15);
    expect(impl.originalSize).toEqual({ width: 400, height: 300 });
    expect(impl.format).toBe('webp');
  });
});

// ─── ElementResultImpl ────────────────────────────────────────────────────

describe('ElementResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const img = document.createElement('img');
    const impl = new ElementResultImpl(img, 1024, 768, 30, { width: 2048, height: 1536 }, 'png');

    expect(impl.element).toBe(img);
    expect(impl.width).toBe(1024);
    expect(impl.height).toBe(768);
    expect(impl.processingTime).toBe(30);
    expect(impl.originalSize).toEqual({ width: 2048, height: 1536 });
    expect(impl.format).toBe('png');
  });

  it('선택 인자(originalSize, format) 없이 생성하면 undefined다', () => {
    const img = document.createElement('img');
    const impl = new ElementResultImpl(img, 100, 100, 1);

    expect(impl.originalSize).toBeUndefined();
    expect(impl.format).toBeUndefined();
  });
});
