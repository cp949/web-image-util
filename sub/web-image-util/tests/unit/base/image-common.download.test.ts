/**
 * image-common.ts 다운로드 helper의 anchor DOM 조작 단위 테스트.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, downloadLink } from '../../../src/base/image-common';
import { createImageBlob, spyCreateAnchor } from './image-common.helpers';

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('download 지원 환경에서 anchor 요소를 DOM에 추가하고 클릭 후 제거한다', () => {
    const blob = createImageBlob('image/png', ['data']);
    const fakeObjectUrl = 'blob:http://localhost/test-fake-id';

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeObjectUrl);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const captured = spyCreateAnchor();

    downloadBlob(blob, 'photo.png');

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(appendSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(captured.anchor).not.toBeNull();
    expect(captured.anchor!.href).toBe(fakeObjectUrl);
    expect(captured.anchor!.download).toBe('photo.png');
    expect(captured.anchor!.type).toBe('image/png');
    expect(captured.clickSpy).not.toBeNull();
    expect(captured.clickSpy!).toHaveBeenCalledTimes(1);
    // click 후 revoke 순서 보장 (click → revokeObjectURL)
    expect(captured.clickSpy!.mock.invocationCallOrder[0]).toBeLessThan(revokeSpy.mock.invocationCallOrder[0]);
    expect(revokeSpy).toHaveBeenCalledWith(fakeObjectUrl);
    expect(removeSpy).toHaveBeenCalled();
  });

  it('anchor에 crossorigin 속성이 anonymous로 설정된다', () => {
    const blob = createImageBlob('image/png');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/x');
    vi.spyOn(URL, 'revokeObjectURL');
    const captured = spyCreateAnchor();

    downloadBlob(blob, 'image.png');

    expect(captured.anchor).not.toBeNull();
    expect(captured.anchor!.getAttribute('crossorigin')).toBe('anonymous');
    expect(captured.clickSpy).not.toBeNull();
    expect(captured.clickSpy!).toHaveBeenCalledTimes(1);
  });
});

describe('downloadLink', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('download 지원 환경에서 anchor 요소를 DOM에 추가하고 클릭 후 제거한다', () => {
    const href = 'https://example.com/file.bin';

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const captured = spyCreateAnchor();

    downloadLink(href);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(appendSpy).toHaveBeenCalled();
    expect(captured.anchor).not.toBeNull();
    expect(captured.anchor!.href).toBe(href);
    expect(captured.anchor!.type).toBe('application/octet-stream');
    expect(captured.clickSpy).not.toBeNull();
    expect(captured.clickSpy!).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalled();
  });
});
