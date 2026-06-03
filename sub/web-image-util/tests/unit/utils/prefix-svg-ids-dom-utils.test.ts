import { describe, expect, it } from 'vitest';
import {
  detectPrefixEnvironment,
  detectStyleDeoptReasons,
  parseSvgDocument,
  serializeSvgDocument,
} from '../../../src/utils/prefix-svg-ids/dom-utils';

/** 테스트용 SVG 문서를 파싱한다(정상 입력 가정). */
function parseDoc(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('dom-utils helper', () => {
  describe('detectPrefixEnvironment', () => {
    it('알려진 환경 값 중 하나를 반환한다', () => {
      expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(detectPrefixEnvironment());
    });
  });

  describe('parseSvgDocument', () => {
    it('정상 SVG는 Document를 반환한다', () => {
      const result = parseSvgDocument('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>');
      expect('failure' in result).toBe(false);
      expect((result as Document).documentElement.tagName.toLowerCase()).toBe('svg');
    });

    it('root가 svg가 아니면 parse-failed', () => {
      expect(parseSvgDocument('<not-svg/>')).toEqual({ failure: 'parse-failed' });
    });

    it('DOMParser 미가용이면 domparser-unavailable', () => {
      const original = globalThis.DOMParser;
      // @ts-expect-error 테스트용으로 일시 제거
      delete globalThis.DOMParser;
      try {
        expect(parseSvgDocument('<svg xmlns="http://www.w3.org/2000/svg"/>')).toEqual({
          failure: 'domparser-unavailable',
        });
      } finally {
        globalThis.DOMParser = original;
      }
    });
  });

  describe('serializeSvgDocument', () => {
    it('Document를 문자열로 직렬화한다', () => {
      const doc = parseDoc('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>');
      const serialized = serializeSvgDocument(doc);
      expect(serialized).toContain('<rect');
      expect(serialized).toContain('id="a"');
    });
  });

  describe('detectStyleDeoptReasons', () => {
    it('style 요소도 속성도 없으면 빈 배열', () => {
      const doc = parseDoc('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>');
      expect(detectStyleDeoptReasons(doc)).toEqual([]);
    });

    it('<style> 요소가 있으면 style-tag-present', () => {
      const doc = parseDoc('<svg xmlns="http://www.w3.org/2000/svg"><style>.a{}</style></svg>');
      expect(detectStyleDeoptReasons(doc)).toContain('style-tag-present');
    });

    it('style 속성이 있으면 style-attribute-present', () => {
      const doc = parseDoc('<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:red"/></svg>');
      expect(detectStyleDeoptReasons(doc)).toContain('style-attribute-present');
    });
  });
});
