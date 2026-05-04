import { describe, expect, it } from 'vitest';
import { processImage } from '../../../../src/processor';
import { createTestImageBlob } from '../../../utils/image-helper';

describe('연산 체이닝', () => {
  it('resize 뒤에 blur를 체이닝한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'purple');
    const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).blur(2).toBlob();

    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('최종 크기를 직접 지정하면 결과 크기가 정확히 일치한다', async () => {
    const testBlob = await createTestImageBlob(800, 600, 'orange');
    const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toCanvas();

    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });
});
