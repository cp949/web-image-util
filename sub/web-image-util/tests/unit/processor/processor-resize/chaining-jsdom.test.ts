/**
 * processImage 체이닝 검증 중 Canvas 입력만 사용해 jsdom에서 안전한 케이스를 모은다.
 *
 * 분리 기준:
 * - Blob 입력은 production이 내부에서 createObjectURL → Image.src 흐름을 거쳐 jsdom에서 막힌다.
 * - Canvas 입력은 source-converter가 그대로 처리해 출력 메서드까지 jsdom에서 통과한다.
 *
 * Blob 입력 흐름은 jsdom의 Blob URL 이미지 로딩 제약 때문에 이 파일에서 다루지 않는다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../../src/processor';
import { createTestCanvas } from '../../../utils/canvas-helper';

describe('연산 체이닝 (Canvas 입력, jsdom-safe)', () => {
  it('resize 뒤에 blur를 체이닝한다', async () => {
    const canvas = createTestCanvas(400, 300, 'purple');
    const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).blur(2).toBlob();

    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('최종 크기를 직접 지정하면 결과 크기가 정확히 일치한다', async () => {
    const canvas = createTestCanvas(800, 600, 'orange');
    const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toCanvas();

    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });
});
