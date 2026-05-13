/**
 * deprecated File 변환 API의 happy-dom 한정 동작을 검증한다.
 * jsdom + canvas 패키지는 webp 인코딩을 지원하지 않아 `canvas.toBlob('image/webp', ...)`가
 * PNG로 떨어지면서 MIME 단정이 깨진다. 이 케이스는 happy-dom 환경에서만 안전하다.
 *
 * Canvas 입력 + 지원 포맷 케이스는 `converters-file-canvas.test.ts`(jsdom)에 있다.
 */

import { describe, expect, it } from 'vitest';
import { convertToFile } from '../../../src/utils/converters/file';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('File 변환 유틸 (webp 등 jsdom 미지원 경로)', () => {
  it('convertToFile은 autoExtension이 false이면 원래 파일명을 유지한다', async () => {
    const canvas = createTestCanvas(80, 80, 'blue');

    const file = await convertToFile(canvas, 'avatar.png', {
      format: 'webp',
      autoExtension: false,
    });

    expect(file.name).toBe('avatar.png');
    expect(file.type).toBe('image/webp');
  });
});
