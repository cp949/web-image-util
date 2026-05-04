import { describe, expect, it } from 'vitest';

describe('unsafe_processImage', () => {
  it('루트 엔트리에서 공개된다', async () => {
    const { unsafe_processImage } = await import('../../../../src');
    expect(unsafe_processImage).toBeTypeOf('function');
  });
});
