import { describe, expect, it } from 'vitest';
import { collectSvgCssReferenceSignals } from '../../../src/utils/svg-inspection/css-signals.internal';

function parseSvg(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('collectSvgCssReferenceSignals()', () => {
  it('style 속성의 외부 url 참조를 수집한다', () => {
    const doc = parseSvg('<svg><rect style="fill:url(https://example.test/a.svg#x)" /></svg>');
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(1);
    expect(signals.externalCssSamples).toEqual(['style']);
  });

  it('대소문자가 다른 style 속성의 외부 url 참조도 수집한다', () => {
    const doc = parseSvg('<svg><rect STYLE="fill:url(https://example.test/a.svg#x)" /></svg>');
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(1);
    expect(signals.externalCssSamples).toEqual(['style']);
  });

  it('style 태그의 외부 url 참조를 style-tag sample로 수집한다', () => {
    const doc = parseSvg('<svg><style>.x{fill:url(https://example.test/a.svg#x)}</style></svg>');
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(1);
    expect(signals.externalCssSamples).toEqual(['style-tag']);
  });

  it('대소문자가 다른 style 태그의 외부 url 참조도 style-tag sample로 수집한다', () => {
    const doc = parseSvg('<svg><STYLE>.x{fill:url(https://example.test/a.svg#x)}</STYLE></svg>');
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(1);
    expect(signals.externalCssSamples).toEqual(['style-tag']);
  });

  it('내부 fragment CSS 참조는 외부 CSS로 세지 않는다', () => {
    const doc = parseSvg('<svg><style>.x{fill:url(#grad)}</style><rect style="fill:url(#grad)" /></svg>');
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(0);
    expect(signals.externalCssSamples).toEqual([]);
  });

  it('내부 fragment 외 CSS 참조(상대 경로 포함)를 외부 CSS로 센다', () => {
    const doc = parseSvg(
      '<svg><style>.x{fill:url(../pattern.svg#p)}</style><rect style="fill:url(/mask.svg#m)" /></svg>'
    );
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(2);
    expect(signals.externalCssSamples).toEqual(['style', 'style-tag']);
  });

  it('presentation 속성의 CSS URL도 외부 CSS로 센다', () => {
    const doc = parseSvg('<svg><rect fill="url(https://example.test/pattern.svg#p)" /></svg>');
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(1);
    expect(signals.externalCssSamples).toEqual(['fill']);
  });

  it('image-set 내부 외부 URL 문자열도 외부 CSS로 센다', () => {
    const doc = parseSvg(
      '<svg><rect style="background-image:image-set(&quot;https://example.test/a.png&quot; 1x)" /></svg>'
    );
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(1);
    expect(signals.externalCssSamples).toEqual(['style']);
  });

  it('image-set 내부 url을 중복 카운트하지 않는다', () => {
    const doc = parseSvg('<svg><rect style="background-image:image-set(url(https://example.test/a.png) 1x)" /></svg>');
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(1);
    expect(signals.externalCssSamples).toEqual(['style']);
  });

  it('@import 내부 url을 중복 카운트하지 않는다', () => {
    const doc = parseSvg('<svg><style>@import url("https://example.test/a.css");</style></svg>');
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(1);
    expect(signals.externalCssSamples).toEqual(['style-tag']);
  });

  it('escape로 감춘 여러 url 참조를 occurrence 단위로 센다', () => {
    const doc = parseSvg(
      '<svg><rect style="fill:u\\72l(https://example.test/a.svg);stroke:u\\72l(https://example.test/b.svg)" /></svg>'
    );
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(2);
    expect(signals.externalCssSamples).toEqual(['style']);
  });

  it('한 style 속성 또는 태그 안의 차단 url 참조를 occurrence 단위로 센다', () => {
    const doc = parseSvg(
      '<svg><style>.a{fill:url(https://example.test/a.svg#x);stroke:url(https://example.test/b.svg#y)}</style><rect style="fill:url(https://example.test/c.svg#z);stroke:url(#local)" /></svg>'
    );
    const signals = collectSvgCssReferenceSignals(doc);
    expect(signals.externalCssCount).toBe(3);
    expect(signals.externalCssSamples).toEqual(['style', 'style-tag']);
  });
});
