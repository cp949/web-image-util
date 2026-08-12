import { describe, expect, it } from 'vitest';
import { collectSvgDomSecuritySignals } from '../../../src/utils/svg-inspection/dom-signals.internal';

function parseSvg(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('collectSvgDomSecuritySignals()', () => {
  it('script와 foreignObject 요소 수를 수집한다', () => {
    const doc = parseSvg('<svg><script>alert(1)</script><foreignObject /></svg>');
    const signals = collectSvgDomSecuritySignals(doc);
    expect(signals.scriptElementCount).toBe(1);
    expect(signals.foreignObjectElementCount).toBe(1);
  });

  it('대소문자가 다른 script와 foreignObject 요소도 수집한다', () => {
    const doc = parseSvg('<svg><SCRIPT>alert(1)</SCRIPT><foreignobject /></svg>');
    const signals = collectSvgDomSecuritySignals(doc);
    expect(signals.scriptElementCount).toBe(1);
    expect(signals.foreignObjectElementCount).toBe(1);
  });

  it('event handler와 외부 href 참조를 수집한다', () => {
    const doc = parseSvg('<svg><use onclick="x()" href="https://example.test/a.svg#id" /></svg>');
    const signals = collectSvgDomSecuritySignals(doc);
    expect(signals.eventHandlerAttributeCount).toBe(1);
    expect(signals.eventHandlerAttributeSamples).toEqual(['onclick']);
    expect(signals.externalHrefCount).toBe(1);
    expect(signals.externalHrefSamples).toEqual(['href']);
  });

  it('내부 fragment와 안전한 raster data image는 외부 href로 세지 않는다', () => {
    const doc = parseSvg(
      '<svg><use href="#icon" /><image href="data:image/png;base64,AAAA" /><image href="data:image/jpeg;base64,AAAA" /></svg>'
    );
    const signals = collectSvgDomSecuritySignals(doc);
    expect(signals.externalHrefCount).toBe(0);
    expect(signals.externalHrefSamples).toEqual([]);
  });

  it('내부 fragment와 data: 외 참조(상대·절대 경로 포함)를 제거 대상으로 센다', () => {
    const doc = parseSvg('<svg><use href="../sprite.svg#a" /><image src="/assets/a.png" /><use href="#local" /></svg>');
    const signals = collectSvgDomSecuritySignals(doc);
    expect(signals.externalHrefCount).toBe(2);
    expect(signals.externalHrefSamples).toEqual(['href', 'src']);
  });

  it('namespace prefix가 달라도 localName이 href인 외부 참조를 센다', () => {
    const doc = parseSvg(
      '<svg xmlns:foo="http://example.test/foo"><use foo:href="https://example.test/sprite.svg#id" /></svg>'
    );
    const signals = collectSvgDomSecuritySignals(doc);
    expect(signals.externalHrefCount).toBe(1);
    expect(signals.externalHrefSamples).toEqual(['foo:href']);
  });

  it('sample은 32자 이하로 3개까지만 보존한다', () => {
    const doc = parseSvg('<svg><g oncustomlongattribute000000000000000000001="1" ona="2" onb="3" onc="4" /></svg>');
    const signals = collectSvgDomSecuritySignals(doc);
    expect(signals.eventHandlerAttributeCount).toBe(4);
    expect(signals.eventHandlerAttributeSamples).toHaveLength(3);
    expect(signals.eventHandlerAttributeSamples.every((sample) => sample.length <= 32)).toBe(true);
  });
});
