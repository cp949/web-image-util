/**
 * postProcessSanitized의 파싱 후처리 분기를 직접 검증한다.
 *
 * core 전체 경로가 아니라 빈 입력, parsererror, 비-SVG 루트, metadata 제거,
 * 정상 재직렬화 분기만 고정한다. nestedSanitize는 호출되지 않는 stub로 둔다.
 */

import { describe, expect, it } from 'vitest';

import { postProcessSanitized } from '../../../src/svg-sanitizer/postprocess';
import type { NestedSanitize } from '../../../src/svg-sanitizer/types';

// metadata/위험요소 없는 입력에서는 호출되지 않으므로 빈 결과 stub로 둔다.
const noopNested: NestedSanitize = () => ({ svg: '', warnings: [] });

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('postProcessSanitized', () => {
  it('빈 문자열은 파싱 없이 빈 결과를 반환한다', () => {
    const warnings: string[] = [];

    expect(postProcessSanitized('   ', false, warnings, undefined, 0, noopNested)).toEqual({
      svg: '',
      nodeCount: 0,
    });
    expect(warnings).toHaveLength(0);
  });

  it('parsererror가 발생하면 fail-closed로 빈 결과를 반환한다', () => {
    const warnings: string[] = [];

    expect(postProcessSanitized('<svg><a', false, warnings, undefined, 0, noopNested)).toEqual({
      svg: '',
      nodeCount: 0,
    });
  });

  it('루트가 SVG가 아니면 fail-closed로 빈 결과를 반환한다', () => {
    const warnings: string[] = [];

    expect(postProcessSanitized('<root></root>', false, warnings, undefined, 0, noopNested)).toEqual({
      svg: '',
      nodeCount: 0,
    });
  });

  it('removeMetadata=true면 metadata를 제거하고 경고를 남긴다', () => {
    const warnings: string[] = [];
    const input = `<svg xmlns="${SVG_NS}"><metadata><x/></metadata><rect/></svg>`;

    const result = postProcessSanitized(input, true, warnings, undefined, 0, noopNested);

    expect(result.svg).not.toContain('metadata');
    expect(result.svg).toContain('<rect');
    // metadata 자손이 사라지므로 남는 자손 Element는 rect 1개다.
    expect(result.nodeCount).toBe(1);
    expect(warnings).toContain('<metadata> 요소가 제거되었습니다.');
  });

  it('metadata가 없으면 removeMetadata=true여도 경고 없이 재직렬화한다', () => {
    const warnings: string[] = [];
    const input = `<svg xmlns="${SVG_NS}"><rect/></svg>`;

    const result = postProcessSanitized(input, true, warnings, undefined, 0, noopNested);

    expect(result.svg).toContain('<rect');
    expect(result.nodeCount).toBe(1);
    expect(warnings).toHaveLength(0);
  });

  it('정상 SVG는 자손 개수를 세고 그대로 직렬화한다', () => {
    const warnings: string[] = [];
    const input = `<svg xmlns="${SVG_NS}"><g><rect/><circle/></g></svg>`;

    const result = postProcessSanitized(input, false, warnings, undefined, 0, noopNested);

    expect(result.svg).toContain('<svg');
    // g, rect, circle = 3개 자손 Element
    expect(result.nodeCount).toBe(3);
  });

  // DOMPurify 우회 후에도 strict 정책이 재적용되는지 확인한다.
  // DOMPurify를 거치지 않은 위험 입력을 직접 넣어 enforceStrictDomPolicy 동작을 고정한다.
  // 이 검증이 없으면 enforceStrictDomPolicy가 no-op가 되어도 테스트가 통과한다.
  it('정제 후 남은 script 요소를 제거하고 경고를 남긴다', () => {
    const warnings: string[] = [];
    const input = `<svg xmlns="${SVG_NS}"><script>alert(1)</script><rect/></svg>`;

    const result = postProcessSanitized(input, false, warnings, undefined, 0, noopNested);

    expect(result.svg).not.toContain('<script');
    expect(result.svg).not.toContain('alert(1)');
    expect(result.svg).toContain('<rect');
    expect(warnings).toContain('위험 SVG 요소가 제거되었습니다.');
  });

  it('정제 후 남은 foreignObject 요소를 제거한다', () => {
    const warnings: string[] = [];
    const input = `<svg xmlns="${SVG_NS}"><foreignObject><div/></foreignObject><rect/></svg>`;

    const result = postProcessSanitized(input, false, warnings, undefined, 0, noopNested);

    expect(result.svg.toLowerCase()).not.toContain('foreignobject');
    expect(result.svg).toContain('<rect');
    expect(warnings).toContain('위험 SVG 요소가 제거되었습니다.');
  });

  it('on* 이벤트 핸들러 속성을 제거하고 경고를 남긴다', () => {
    const warnings: string[] = [];
    const input = `<svg xmlns="${SVG_NS}"><rect onload="alert(1)" width="1" height="1"/></svg>`;

    const result = postProcessSanitized(input, false, warnings, undefined, 0, noopNested);

    expect(result.svg).not.toContain('onload');
    // 안전 속성(width/height)은 보존된다.
    expect(result.svg).toContain('width="1"');
    expect(warnings).toContain('이벤트 핸들러 속성이 제거되었습니다.');
  });

  it('외부 href 참조 속성을 제거하고 경고를 남긴다', () => {
    const warnings: string[] = [];
    const input = `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.example/x.svg"/></svg>`;

    const result = postProcessSanitized(input, false, warnings, undefined, 0, noopNested);

    expect(result.svg).not.toContain('evil.example');
    expect(warnings).toContain('외부 URI 참조 속성이 제거되었습니다.');
  });
});
