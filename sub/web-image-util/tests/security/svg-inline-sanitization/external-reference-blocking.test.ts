/**
 * 인라인 SVG 내부의 상대/로컬 외부 참조 차단 계약을 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureImageElement } from '../../../src/utils/converters';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 인라인 SVG 외부 참조 차단', () => {
  it('상대 경로 href는 sanitizer가 속성을 제거해 무해화한 뒤 렌더링한다', async () => {
    const svgWithRelativeRef =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';

    // URI allowlist 통일로 상대 경로는 에러가 아니라 조용한 제거로 무해화된다 —
    // 참조가 제거되므로 동일 출처 fetch는 발생하지 않는다
    const element = await ensureImageElement(svgWithRelativeRef);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('따옴표 없는 상대 경로 href도 속성 제거로 무해화한 뒤 렌더링한다', async () => {
    const svgWithRelativeRef =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href=./assets/pattern.png width="10" height="10"/></svg>';

    const element = await ensureImageElement(svgWithRelativeRef);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('CSS escape로 숨긴 상대 경로 style URL도 외부 리소스로 간주해 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\\2e \\2e /secret.png)"/></svg>';

    await expect(ensureImageElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'style-attribute-url' },
    });
  });

  it('엔티티로 분할된 CSS escape 상대 경로 style URL도 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\\00002&#x65; \\00002&#x65; /secret.png)"/></svg>';

    await expect(ensureImageElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'style-attribute-url' },
    });
  });

  it('함수명과 값에 엔티티로 분할된 CSS escape가 있어도 상대 경로 style URL을 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:u\\00007&#x32;l(\\00002&#x65; \\00002&#x65; /secret.png)"/></svg>';

    await expect(ensureImageElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'style-attribute-url' },
    });
  });

  it('CSS escape로 숨긴 루트 절대 경로 style URL도 외부 리소스로 간주해 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\\2f assets/tracker.png)"/></svg>';

    await expect(ensureImageElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'style-attribute-url' },
    });
  });

  it('루트 절대 경로 href도 속성 제거로 무해화한 뒤 렌더링한다', async () => {
    const svgWithAbsoluteRef =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="/assets/pattern.png" width="10" height="10"/></svg>';

    const element = await ensureImageElement(svgWithAbsoluteRef);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });
});
