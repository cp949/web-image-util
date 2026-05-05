/**
 * 프리셋 API가 공개 옵션을 이미지 처리 파이프라인에 올바르게 반영하는지 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { createAvatar, createSocialImage, createThumbnail } from '../../../src/presets';
import { createTestImageBlob } from '../../utils/image-helper';

describe('프리셋 이미지 생성', () => {
  it('숫자 size 썸네일은 정사각형 결과와 기본 WebP 포맷을 반환한다', async () => {
    const source = await createTestImageBlob(400, 300, 'red');

    const result = await createThumbnail(source, { size: 96 });

    expect(result.width).toBe(96);
    expect(result.height).toBe(96);
    expect(result.blob.type).toBe('image/webp');
    expect(result.format).toBe('webp');
  });

  it('객체 size 썸네일은 height 생략 시 width를 높이로 사용한다', async () => {
    const source = await createTestImageBlob(400, 300, 'blue');

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
    const source = await createTestImageBlob(320, 240, 'green');

    const result = await createAvatar(source);

    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.blob.type).toBe('image/png');
    expect(result.format).toBe('png');
  });

  it('소셜 이미지는 플랫폼 권장 크기와 사용자 지정 포맷을 반영한다', async () => {
    const source = await createTestImageBlob(640, 480, 'purple');

    const result = await createSocialImage(source, {
      platform: 'youtube',
      format: 'webp',
      quality: 0.75,
    });

    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.blob.type).toBe('image/webp');
    expect(result.format).toBe('webp');
  });

  it('소셜 이미지는 customSize가 있으면 플랫폼 기본 크기보다 우선한다', async () => {
    const source = await createTestImageBlob(640, 480, 'orange');

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
