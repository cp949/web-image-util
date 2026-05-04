import { describe, expect, it } from 'vitest';
import { processImage } from '../../../../src/processor';
import { ImageProcessError } from '../../../../src/types';
import { createTestImageBlob } from '../../../utils/image-helper';

describe('중복 resize 방지', () => {
  it('단일 resize 호출은 허용한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'blue');
    const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('두 번째 resize() 호출은 MULTIPLE_RESIZE_NOT_ALLOWED 코드로 거부한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'blue');
    const processor = processImage(testBlob);

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
    const testBlob = await createTestImageBlob(400, 300, 'blue');

    const processor1 = processImage(testBlob);
    const processor2 = processImage(testBlob);

    const result1 = await processor1.resize({ fit: 'cover', width: 200, height: 200 }).toBlob();
    const result2 = await processor2.resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

    expect(result1.width).toBe(200);
    expect(result2.width).toBe(100);
  });

  it('resize 이후 blur는 허용한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'blue');
    const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).blur(5).toBlob();

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('에러 코드로 프로그래매틱 처리가 가능하다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'blue');
    const processor = processImage(testBlob);

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
