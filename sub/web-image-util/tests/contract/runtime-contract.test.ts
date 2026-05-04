/**
 * 공개 API 런타임 계약 테스트
 *
 * @description
 * 핵심 진입점들이 기대한 형태(함수 / 클래스 / 객체)로 노출되고,
 * 핵심 체이닝 메서드와 상수의 모양이 유지되는지 확인한다.
 * Canvas 실제 렌더링은 다루지 않으며, 시그니처/모양만 검증한다.
 */

import { describe, expect, test } from 'vitest';

import {
  createAvatar,
  createSocialImage,
  createThumbnail,
  enhanceSvgForBrowser,
  extractSvgDimensions,
  features,
  formatToMimeType,
  ImageProcessError,
  ImageProcessor,
  isDataURLString,
  isInlineSvg,
  isSupportedOutputFormat,
  mimeTypeToImageFormat,
  OPTIMAL_QUALITY_BY_FORMAT,
  processImage,
  resolveOutputFormat,
  ShortcutBuilder,
  sanitizeSvg,
  sanitizeSvgForRendering,
  unsafe_processImage,
} from '../../src';
import { sanitizeSvgStrict, sanitizeSvgStrictDetailed } from '../../src/svg-sanitizer';

const SAMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="red"/></svg>';

describe('processImage 진입점 계약', () => {
  test('processImage는 함수이고 체이닝 가능한 프로세서를 반환한다', () => {
    expect(processImage).toBeTypeOf('function');

    const processor = processImage(SAMPLE_SVG);
    expect(processor).toBeDefined();
    expect(processor.resize).toBeTypeOf('function');
    expect(processor.blur).toBeTypeOf('function');
    expect(processor.toBlob).toBeTypeOf('function');
    expect(processor.toDataURL).toBeTypeOf('function');
    expect(processor.toFile).toBeTypeOf('function');
    expect(processor.toCanvas).toBeTypeOf('function');
  });

  test('unsafe_processImage는 동일 시그니처의 별도 진입점으로 노출된다', () => {
    expect(unsafe_processImage).toBeTypeOf('function');
    expect(unsafe_processImage).not.toBe(processImage);

    const processor = unsafe_processImage(SAMPLE_SVG);
    expect(processor.resize).toBeTypeOf('function');
    expect(processor.toBlob).toBeTypeOf('function');
  });

  test('ImageProcessor는 클래스 생성자로 노출된다', () => {
    expect(ImageProcessor).toBeTypeOf('function');
    expect(ImageProcessor.prototype).toBeDefined();
    expect(ImageProcessor.prototype.resize).toBeTypeOf('function');
    expect(ImageProcessor.prototype.toBlob).toBeTypeOf('function');
  });

  test('ShortcutBuilder는 클래스 생성자로 노출된다', () => {
    expect(ShortcutBuilder).toBeTypeOf('function');
    expect(ShortcutBuilder.prototype).toBeDefined();
  });
});

describe('preset 함수 계약', () => {
  test('createThumbnail / createAvatar / createSocialImage는 비동기 함수다', () => {
    for (const fn of [createThumbnail, createAvatar, createSocialImage]) {
      expect(fn).toBeTypeOf('function');
      expect(fn.constructor.name).toBe('AsyncFunction');
      // 공개 preset은 이미지 source를 첫 번째 인자로 받는다.
      expect(fn.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('에러 / 상수 계약', () => {
  test('ImageProcessError는 Error 하위 클래스이며 code 필드를 노출한다', () => {
    const err = new ImageProcessError('test failure', 'PROCESSING_FAILED');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ImageProcessError');
    expect(err.code).toBe('PROCESSING_FAILED');
  });

  test('OPTIMAL_QUALITY_BY_FORMAT은 모든 출력 포맷의 기본 품질을 정의한다', () => {
    expect(OPTIMAL_QUALITY_BY_FORMAT).toMatchObject({
      png: 1.0,
      jpeg: expect.any(Number),
      jpg: expect.any(Number),
      webp: expect.any(Number),
      avif: expect.any(Number),
    });

    for (const value of Object.values(OPTIMAL_QUALITY_BY_FORMAT)) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test('features 퍼사드는 4가지 boolean 속성을 노출한다', () => {
    expect(features).toBeDefined();
    expect(typeof features.webp).toBe('boolean');
    expect(typeof features.avif).toBe('boolean');
    expect(typeof features.offscreenCanvas).toBe('boolean');
    expect(typeof features.imageBitmap).toBe('boolean');
  });
});

describe('포맷/Data URL 유틸 계약', () => {
  test('formatToMimeType은 알려진 포맷을 MIME 타입으로 변환한다', () => {
    expect(formatToMimeType('png')).toBe('image/png');
    expect(formatToMimeType('jpeg')).toBe('image/jpeg');
    expect(formatToMimeType('webp')).toBe('image/webp');
  });

  test('mimeTypeToImageFormat은 MIME 타입을 포맷으로 역변환한다', () => {
    expect(mimeTypeToImageFormat('image/png')).toBe('png');
    expect(mimeTypeToImageFormat('image/jpeg')).toBe('jpeg');
  });

  test('isSupportedOutputFormat은 출력 포맷 화이트리스트를 반영한다', () => {
    expect(isSupportedOutputFormat('webp')).toBe(true);
    expect(isSupportedOutputFormat('gif')).toBe(false);
  });

  test('resolveOutputFormat은 지원 목록 안에서 선호 포맷을 우선 사용한다', () => {
    expect(resolveOutputFormat('png')).toBe('png');
    expect(resolveOutputFormat('webp', { supported: ['png'] })).toBe('png');
  });

  test('isDataURLString은 data: URL 여부를 판정한다', () => {
    expect(isDataURLString('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isDataURLString('https://example.com/image.png')).toBe(false);
    expect(isDataURLString('not a url')).toBe(false);
  });
});

describe('SVG 유틸 계약', () => {
  test('isInlineSvg는 인라인 SVG 문자열을 감지한다', () => {
    expect(isInlineSvg(SAMPLE_SVG)).toBe(true);
    expect(isInlineSvg('<div>not svg</div>')).toBe(false);
    expect(isInlineSvg('https://example.com/image.svg')).toBe(false);
  });

  test('extractSvgDimensions는 width/height를 추출한다', () => {
    const dims = extractSvgDimensions(SAMPLE_SVG);
    expect(dims).toMatchObject({ width: 40, height: 20 });
  });

  test('sanitizeSvg는 정제된 SVG 문자열을 반환한다', () => {
    const result = sanitizeSvg(SAMPLE_SVG);
    expect(typeof result).toBe('string');
    expect(result).toContain('<svg');
  });

  test('sanitizeSvgForRendering은 경량 렌더링 guard이며 sanitizeSvg alias와 같은 결과를 반환한다', () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>';

    expect(sanitizeSvgForRendering(unsafeSvg)).toBe(sanitizeSvg(unsafeSvg));
    expect(sanitizeSvgForRendering(unsafeSvg)).not.toContain('<script');
    expect(sanitizeSvgForRendering(unsafeSvg)).not.toContain('onload');
  });

  test('enhanceSvgForBrowser는 보강된 SVG 문자열을 반환한다', () => {
    const enhanced = enhanceSvgForBrowser(SAMPLE_SVG);
    expect(typeof enhanced).toBe('string');
    expect(enhanced).toContain('<svg');
  });
});

describe('strict SVG sanitizer 서브패스 계약', () => {
  test('sanitizeSvgStrict는 위험 SVG 요소와 외부 참조를 제거한다', () => {
    const result = sanitizeSvgStrict(
      '<svg><foreignObject><div>unsafe</div></foreignObject><image href="https://example.com/a.png"/></svg>'
    );

    expect(result).toContain('<svg');
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('https://example.com/a.png');
  });

  test('sanitizeSvgStrictDetailed는 strict 정책을 완화하는 DOMPurify 설정을 무시한다', () => {
    const result = sanitizeSvgStrictDetailed('<svg><foreignObject><div>unsafe</div></foreignObject></svg>', {
      domPurifyConfig: {
        ALLOWED_TAGS: ['svg', 'foreignObject', 'div'],
        RETURN_DOM: true,
      },
    });

    expect(result.svg).toContain('<svg');
    expect(result.svg).not.toContain('foreignObject');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('ALLOWED_TAGS'), expect.stringContaining('RETURN_DOM')])
    );
  });
});
