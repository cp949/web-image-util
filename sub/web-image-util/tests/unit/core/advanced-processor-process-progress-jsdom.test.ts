/**
 * AdvancedImageProcessor.processImage onProgress 콜백 시퀀스 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleWatermark } from '../../../src/composition/simple-watermark';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';
import { createDrawableSource, createMockImage } from './advanced-processor-branches.helpers';
import { installImageDataMock, mockSmartResize } from './advanced-processor-process.helpers';

describe('AdvancedImageProcessor.processImage onProgress 콜백 시퀀스', () => {
  beforeEach(() => {
    mockSmartResize();
    installImageDataMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resize + watermark + format 조합에서 stage 가 올바른 순서로 호출된다', async () => {
    vi.spyOn(SimpleWatermark, 'addText').mockImplementation((canvas) => canvas);

    const stages: string[] = [];
    const onProgress = (stage: string) => stages.push(stage);

    const img = createMockImage(200, 150);
    await AdvancedImageProcessor.processImage(img, {
      resize: { width: 200, height: 150 },
      watermark: { text: { text: '워터마크' } },
      format: 'jpeg',
      onProgress,
    });

    expect(stages).toEqual(['resizing', 'filtering', 'watermarking', 'optimizing', 'finalizing']);
  });

  it('resize 없을 때는 filtering 부터 시작해 finalizing 으로 끝난다', async () => {
    const stages: string[] = [];
    const onProgress = (stage: string) => stages.push(stage);

    const source = createDrawableSource(200, 150);
    await AdvancedImageProcessor.processImage(source, { onProgress });

    expect(stages).toEqual(['filtering', 'watermarking', 'optimizing', 'finalizing']);
  });
});
