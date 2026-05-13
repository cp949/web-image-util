/**
 * 프리셋 API 검증 중 Canvas 입력만 사용해 jsdom에서 안전한 케이스를 모은다.
 *
 * 분리 기준:
 * - Blob 입력 흐름은 jsdom의 Blob URL 이미지 로딩 제약 때문에 이 파일에서 다루지 않는다.
 * - webp 포맷을 단정하는 케이스는 jsdom + canvas 패키지의 webp 미지원(PNG fallback) 때문에 빠진다.
 *   실제 브라우저 포맷 경로는 browser 스모크에서 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { createAvatar, createSocialImage, createThumbnail } from '../../../src/presets';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('프리셋 이미지 생성 (Canvas 입력, jsdom-safe)', () => {
  it('객체 size 썸네일은 height 생략 시 width를 높이로 사용한다', async () => {
    const source = createTestCanvas(400, 300, 'blue');

    const result = await createThumbnail(source, {
      size: { width: 128 },
      format: 'png',
      fit: 'contain',
      background: 'transparent',
    });

    expect(result.width).toBe(128);
    expect(result.height).toBe(128);
    expect(result.blob.type).toBe('image/png');
    expect(result.format).toBe('png');
  });

  it('아바타는 기본값으로 64px 정사각형 PNG를 만든다', async () => {
    const source = createTestCanvas(320, 240, 'green');

    const result = await createAvatar(source);

    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.blob.type).toBe('image/png');
    expect(result.format).toBe('png');
  });

  it('소셜 이미지는 customSize가 있으면 플랫폼 기본 크기보다 우선한다', async () => {
    const source = createTestCanvas(640, 480, 'orange');

    const result = await createSocialImage(source, {
      platform: 'instagram',
      customSize: { width: 320, height: 180 },
      format: 'png',
    });

    expect(result.width).toBe(320);
    expect(result.height).toBe(180);
    expect(result.blob.type).toBe('image/png');
    expect(result.format).toBe('png');
  });
});
