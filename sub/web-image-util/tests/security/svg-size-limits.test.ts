/**
 * SVG 입력 크기 제한 방어 중 happy-dom 환경에서만 안전하게 실행되는 케이스를 남긴다.
 *
 * 이 케이스는 인코딩 길이가 큰 Data URL SVG를 실제로 디코딩한 뒤 Image로 로드해 통과시켜야 한다.
 * jsdom + canvas 조합은 ~6.5MB 규모의 SVG 문자열을 파싱하면서 시간이 비정상적으로 길어져 hang에 가까워진다.
 * 같은 검증의 happy-dom canvas-mock 경로는 즉시 onload를 호출해주기 때문에 안정적으로 통과한다.
 *
 * jsdom에서 안전한 나머지 9개 크기 제한 케이스는 `svg-size-limits-jsdom.test.ts`에 있다.
 */

import { describe, expect, it } from "vitest";
import { ensureImageElement } from "../../src/utils/converters";
import { SVG_LIMIT_BYTES } from "./helpers/svg-test-helpers";

describe("보안: SVG 크기 제한 (happy-dom 한정)", () => {
  it("URL 인코딩 길이가 길어도 디코딩 후 10MB 이하인 Data URL SVG는 허용한다", async () => {
    const repeatedMarkup = '<text x="1" y="1">%</text>'.repeat(250_000);
    const encodedSvg = `<svg xmlns="http://www.w3.org/2000/svg">${repeatedMarkup}</svg>`;
    const decodedLength = encodedSvg.length;
    const encodedLength = encodeURIComponent(encodedSvg).length;

    expect(decodedLength).toBeLessThan(SVG_LIMIT_BYTES);
    expect(encodedLength).toBeGreaterThan(SVG_LIMIT_BYTES);

    const dataUrl = `data:image/svg+xml,${encodeURIComponent(encodedSvg)}`;
    const element = await ensureImageElement(dataUrl);

    expect(element).toBeInstanceOf(HTMLImageElement);
  });
});
