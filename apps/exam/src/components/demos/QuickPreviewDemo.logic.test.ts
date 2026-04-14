import { describe, expect, it } from 'vitest';
import { shouldReprocessForPresetChange } from './QuickPreviewDemo';

describe('shouldReprocessForPresetChange', () => {
  it('returns false when the preset did not change', () => {
    expect(shouldReprocessForPresetChange(true, 'medium', 'medium')).toBe(false);
  });

  it('returns true when an image exists and the preset changed', () => {
    expect(shouldReprocessForPresetChange(true, 'medium', 'large')).toBe(true);
  });

  it('returns false when there is no image yet', () => {
    expect(shouldReprocessForPresetChange(false, 'medium', 'large')).toBe(false);
  });
});
