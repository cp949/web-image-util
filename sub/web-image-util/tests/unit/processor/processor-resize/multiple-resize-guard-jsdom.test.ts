/**
 * processImage의 단일 resize 가드 검증 중 Canvas 입력만 사용해 jsdom에서 안전한 케이스를 모은다.
 *
 * 분리 기준:
 * - Blob 입력 흐름은 jsdom의 Blob URL 이미지 로딩 제약 때문에 이 파일에서 다루지 않는다.
 * - 두 번째 resize는 출력 메서드까지 가지 않고 즉시 throw하므로 Canvas/Blob 차이가 없지만,
 *   일관성을 위해 jsdom 분리본도 Canvas 입력으로 통일한다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../../src/processor';
import { ImageProcessError } from '../../../../src/types';
import { createTestCanvas } from '../../../utils/canvas-helper';

describe('중복 resize 방지 (Canvas 입력, jsdom-safe)', () => {
  it('단일 resize 호출은 허용한다', async () => {
    const canvas = createTestCanvas(400, 300, 'blue');
    const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('두 번째 resize() 호출은 MULTIPLE_RESIZE_NOT_ALLOWED 코드로 거부한다', async () => {
    const canvas = createTestCanvas(400, 300, 'blue');
    const processor = processImage(canvas);

    processor.resize({ fit: 'cover', width: 200, height: 200 });

    try {
      processor.resize({ fit: 'cover', width: 100, height: 100 });
      expect.fail('에러가 발생해야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(ImageProcessError);
      if (error instanceof ImageProcessError) {
        expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
      }
    }
  });

  it('별도 프로세서 인스턴스는 각자 독립적으로 resize할 수 있다', async () => {
    const canvas = createTestCanvas(400, 300, 'blue');

    const processor1 = processImage(canvas);
    const processor2 = processImage(canvas);

    const result1 = await processor1.resize({ fit: 'cover', width: 200, height: 200 }).toBlob();
    const result2 = await processor2.resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

    expect(result1.width).toBe(200);
    expect(result2.width).toBe(100);
  });

  it('resize 이후 blur는 허용한다', async () => {
    const canvas = createTestCanvas(400, 300, 'blue');
    const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).blur(5).toBlob();

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('에러 코드로 프로그래매틱 처리가 가능하다', async () => {
    const canvas = createTestCanvas(400, 300, 'blue');
    const processor = processImage(canvas);

    processor.resize({ fit: 'cover', width: 200, height: 200 });

    try {
      processor.resize({ fit: 'cover', width: 100, height: 100 });
      expect.fail('에러가 발생해야 한다');
    } catch (error) {
      if (error instanceof ImageProcessError) {
        expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
      }
    }
  });
});
