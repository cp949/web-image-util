import { describe, expect, it } from 'vitest';
import {
  blobToDataURL,
  dataURLToBlob,
  decodeSvgDataURL,
  estimateDataURLPayloadByteLength,
  estimateDataURLSize,
  ImageProcessError,
  isDataURLString,
} from '../../../src';
// 판정/헤더 파싱 헬퍼는 공개 barrel에 노출되지 않으므로 leaf 배럴에서 직접 import한다.
import { isSvgDataURL, parseDataURLMimeType } from '../../../src/utils/data-url';
// percent 헬퍼는 공개 barrel에 노출되지 않는 내부 함수이므로 모듈에서 직접 import한다.
import {
  decodePercentEncodedPayload,
  estimatePercentPayloadByteLength,
} from '../../../src/utils/data-url/percent.internal';

/** ImageProcessError를 던지고 code/kind/cause 유무를 검증하는 헬퍼 */
function expectImageProcessError(
  fn: () => unknown,
  expected: { code: string; kind?: string; hasCause?: boolean }
): void {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(ImageProcessError);
  const err = thrown as ImageProcessError;
  expect(err.code).toBe(expected.code);
  if (expected.kind !== undefined) {
    expect((err.details as { kind?: string })?.kind).toBe(expected.kind);
  }
  if (expected.hasCause) {
    expect(err.cause).toBeDefined();
  }
}

describe('Data URL 유틸리티', () => {
  it('Data URL 문자열을 판정한다', () => {
    expect(isDataURLString('data:image/png;base64,abc')).toBe(true);
    expect(isDataURLString('  data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(true);
    expect(isDataURLString('DATA:image/png;base64,abc')).toBe(true);
    expect(isDataURLString('https://example.com/image.png')).toBe(false);
    expect(isDataURLString(null)).toBe(false);
  });

  describe('SVG Data URL 판정', () => {
    it('SVG data URL 헤더만 true로 판정한다', () => {
      expect(isSvgDataURL('data:image/svg+xml,%3Csvg%3E')).toBe(true);
      expect(isSvgDataURL('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true);
      expect(isSvgDataURL('DATA:IMAGE/SVG+XML,%3Csvg%3E')).toBe(true);
      expect(isSvgDataURL('data:image/svg+xml')).toBe(true);
    });

    it('비SVG data URL과 유사 prefix는 false로 판정한다', () => {
      expect(isSvgDataURL('data:image/png;base64,AAAA')).toBe(false);
      expect(isSvgDataURL('data:image/svg+xmlfoo,%3Csvg%3E')).toBe(false);
      expect(isSvgDataURL('https://example.com/icon.svg')).toBe(false);
      expect(isSvgDataURL('')).toBe(false);
    });
  });

  describe('Data URL MIME 타입 파싱', () => {
    it('data URL이 아니면 undefined를 반환한다', () => {
      expect(parseDataURLMimeType('https://example.com/photo.png')).toBeUndefined();
      expect(parseDataURLMimeType('')).toBeUndefined();
    });

    it('파라미터와 base64 마커를 제외한 MIME 토큰을 반환한다', () => {
      expect(parseDataURLMimeType('data:image/png;base64,AAAA')).toBe('image/png');
      expect(parseDataURLMimeType('data:image/svg+xml;charset=utf-8,%3Csvg%3E')).toBe('image/svg+xml');
      expect(parseDataURLMimeType('DATA:Image/PNG;base64,AAAA')).toBe('image/png');
    });

    it('콤마가 없는 헤더도 MIME 토큰을 추출한다', () => {
      expect(parseDataURLMimeType('data:image/webp')).toBe('image/webp');
    });

    it('MIME이 비어 있으면 undefined를 반환한다', () => {
      expect(parseDataURLMimeType('data:,payload')).toBeUndefined();
      expect(parseDataURLMimeType('data:;base64,AAAA')).toBeUndefined();
    });
  });

  it('Blob을 Data URL로 변환한다', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });

    await expect(blobToDataURL(blob)).resolves.toBe('data:text/plain;base64,aGVsbG8=');
  });

  it('base64 Data URL을 Blob으로 변환한다', async () => {
    const blob = dataURLToBlob('data:text/plain;base64,aGVsbG8=');

    await expect(blob.text()).resolves.toBe('hello');
    expect(blob.type).toBe('text/plain');
  });

  it('percent-encoded Data URL을 Blob으로 변환한다', async () => {
    const blob = dataURLToBlob('data:image/svg+xml,%3Csvg%3E%3C/svg%3E');

    await expect(blob.text()).resolves.toBe('<svg></svg>');
    expect(blob.type).toBe('image/svg+xml');
  });

  it('byte-oriented percent-encoded Data URL을 Blob으로 변환한다', async () => {
    const blob = dataURLToBlob('data:application/octet-stream,%FF');
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toBe('application/octet-stream');
    expect(blob.size).toBe(1);
    expect(bytes[0]).toBe(255);
  });

  it('Data URL의 원본 바이트 크기를 추정한다', () => {
    expect(estimateDataURLSize('data:text/plain;base64,aGVsbG8=')).toBe(5);
    expect(estimateDataURLSize('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(11);
    expect(estimateDataURLSize('data:application/octet-stream,%FF')).toBe(1);
  });

  it('Data URL payload byte length를 payload materialize 없이 계산한다', () => {
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,aGVsbG8=')).toBe(5);
    expect(estimateDataURLPayloadByteLength('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(11);
    expect(estimateDataURLPayloadByteLength('data:text/plain,%ED%95%9C글')).toBe(6);
  });

  it('SVG Data URL을 동기적으로 UTF-8 text로 decode한다', () => {
    expect(decodeSvgDataURL('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toEqual({
      mimeType: 'image/svg+xml',
      text: '<svg></svg>',
      isBase64: false,
    });

    expect(decodeSvgDataURL('DATA:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toEqual({
      mimeType: 'image/svg+xml',
      text: '<svg></svg>',
      isBase64: true,
    });

    expect(decodeSvgDataURL('data:IMAGE/SVG+XML,%3Csvg%3E%3C/svg%3E')).toEqual({
      mimeType: 'image/svg+xml',
      text: '<svg></svg>',
      isBase64: false,
    });
  });

  it('SVG Data URL decode는 non-SVG와 malformed payload를 거부한다', () => {
    expectImageProcessError(() => decodeSvgDataURL('data:text/plain,%3Csvg%3E%3C/svg%3E'), {
      code: 'INVALID_SVG_DATA_URL',
    });
    expectImageProcessError(() => decodeSvgDataURL('data:image/svg+xml,%GG'), {
      code: 'INVALID_SVG_DATA_URL',
    });
    expectImageProcessError(() => decodeSvgDataURL('data:image/svg+xml,%3Csvg%3E%FF%3C/svg%3E'), {
      code: 'INVALID_SVG_DATA_URL',
    });
    expectImageProcessError(() => decodeSvgDataURL('data:image/svg+xml;base64,PHN2Zz7/PC9zdmc+'), {
      code: 'INVALID_SVG_DATA_URL',
    });
    expectImageProcessError(() => decodeSvgDataURL('data:image/svg+xml;base64,@@@@'), {
      code: 'INVALID_SVG_DATA_URL',
    });
    expectImageProcessError(() => decodeSvgDataURL('data:image/svg+xml,%3Cdiv%3E%3C/div%3E'), {
      code: 'INVALID_SVG_DATA_URL',
    });
  });

  it('Data URL scheme은 기본적으로 대소문자를 구분하지 않는다', () => {
    expect(estimateDataURLPayloadByteLength('DATA:text/plain;base64,aGk=')).toBe(2);
    expect(estimateDataURLPayloadByteLength('DaTa:text/plain;base64,aGk=')).toBe(2);
    expectImageProcessError(
      () => estimateDataURLPayloadByteLength('DATA:text/plain;base64,aGk=', { caseSensitiveScheme: true }),
      { code: 'INVALID_DATA_URL' }
    );
    expect(
      estimateDataURLPayloadByteLength('DATA:text/plain;base64,aGk=', {
        caseSensitiveScheme: true,
        invalid: 'null',
      })
    ).toBeNull();
  });

  it('base64 payload byte length 추정은 decode path를 호출하지 않는다', () => {
    const originalAtob = globalThis.atob;
    globalThis.atob = () => {
      throw new Error('atob should not be called');
    };

    try {
      expect(estimateDataURLPayloadByteLength('data:text/plain;base64,aGVsbG8=')).toBe(5);
    } finally {
      globalThis.atob = originalAtob;
    }
  });

  it('invalid 옵션이 null이면 malformed Data URL에서 null을 반환한다', () => {
    expect(estimateDataURLPayloadByteLength('not-data-url', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain,%', { invalid: 'null' })).toBeNull();
    expectImageProcessError(() => estimateDataURLPayloadByteLength('data:text/plain,%'), { code: 'INVALID_DATA_URL' });
  });

  it('malformed base64 alphabet과 padding은 payload byte length 추정에서 거부한다', () => {
    expectImageProcessError(() => estimateDataURLPayloadByteLength('data:text/plain;base64,@@@@'), {
      code: 'INVALID_DATA_URL',
    });
    expectImageProcessError(() => estimateDataURLPayloadByteLength('data:text/plain;base64,a==='), {
      code: 'INVALID_DATA_URL',
    });
    expectImageProcessError(() => estimateDataURLPayloadByteLength('data:text/plain;base64,a=b='), {
      code: 'INVALID_DATA_URL',
    });
    expectImageProcessError(() => estimateDataURLPayloadByteLength('data:text/plain;base64,a='), {
      code: 'INVALID_DATA_URL',
    });
    // ASCII 공백은 무시되므로, non-breaking space( )를 사용해 invalid-base64를 유발한다.
    expectImageProcessError(() => estimateDataURLPayloadByteLength('data:text/plain;base64,aGVs bG8='), {
      code: 'INVALID_DATA_URL',
    });
  });

  it('invalid 옵션이 null이면 malformed base64에서 null을 반환한다', () => {
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,@@@@', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,a===', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,a=b=', { invalid: 'null' })).toBeNull();
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,a=', { invalid: 'null' })).toBeNull();
    // ASCII 공백은 무시되므로, non-breaking space( )를 사용해 invalid-base64를 유발한다.
    expect(estimateDataURLPayloadByteLength('data:text/plain;base64,aGVs bG8=', { invalid: 'null' })).toBeNull();
  });

  it('잘못된 Data URL은 명확한 오류를 던진다', () => {
    expectImageProcessError(() => dataURLToBlob('not-data-url'), { code: 'INVALID_DATA_URL', kind: 'malformed' });
    expectImageProcessError(() => estimateDataURLSize('not-data-url'), { code: 'INVALID_DATA_URL' });
    expectImageProcessError(() => dataURLToBlob('data:text/plain,%GG'), {
      code: 'INVALID_DATA_URL',
      kind: 'invalid-percent',
    });
    expectImageProcessError(() => estimateDataURLSize('data:text/plain,%'), { code: 'INVALID_DATA_URL' });
    expectImageProcessError(() => dataURLToBlob('data:text/plain;base64,@@@@'), {
      code: 'INVALID_DATA_URL',
      kind: 'invalid-base64',
      hasCause: true,
    });
  });

  it('SVG Data URL: percent decode 실패는 cause를 포함한다', () => {
    expectImageProcessError(() => decodeSvgDataURL('data:image/svg+xml,%GG'), {
      code: 'INVALID_SVG_DATA_URL',
      hasCause: true,
    });
  });
});

describe('percent payload 헬퍼', () => {
  /** 기대 byte 배열로 단언하는 헬퍼 */
  function expectBytes(actual: Uint8Array, expected: number[]): void {
    expect(Array.from(actual)).toEqual(expected);
  }

  describe('decodePercentEncodedPayload', () => {
    it('escape되지 않은 ASCII를 그대로 byte로 보존한다', () => {
      expectBytes(decodePercentEncodedPayload('AB'), [65, 66]);
    });

    it('%XX hex를 한 byte로 디코딩한다', () => {
      expectBytes(decodePercentEncodedPayload('%41%42'), [65, 66]);
      expectBytes(decodePercentEncodedPayload('%ff'), [255]);
    });

    it('2-byte UTF-8 문자를 UTF-8 byte로 보존한다', () => {
      expectBytes(decodePercentEncodedPayload('ñ'), Array.from(new TextEncoder().encode('ñ')));
    });

    it('3-byte UTF-8(BMP) 문자를 UTF-8 byte로 보존한다', () => {
      expectBytes(decodePercentEncodedPayload('한'), [0xed, 0x95, 0x9c]);
    });

    it('astral(>0xFFFF) codepoint는 surrogate를 건너뛰고 4-byte로 보존한다', () => {
      expectBytes(decodePercentEncodedPayload('😀'), [0xf0, 0x9f, 0x98, 0x80]);
      // surrogate pair를 두 번 처리하지 않는지 길이로 재확인한다.
      expect(decodePercentEncodedPayload('😀').length).toBe(4);
    });

    it('escape와 일반 문자가 섞인 payload를 순서대로 디코딩한다', () => {
      expectBytes(decodePercentEncodedPayload('%3Csvg%3EA'), [0x3c, 0x73, 0x76, 0x67, 0x3e, 0x41]);
    });

    it('escape되지 않은 +는 공백이 아니라 리터럴 byte로 보존한다', () => {
      // form-urlencoded와 달리 Data URL payload에서 +는 0x2B 그대로 둔다.
      expectBytes(decodePercentEncodedPayload('a+b'), [0x61, 0x2b, 0x62]);
    });

    it('reserved 문자는 escape 없이 리터럴 byte로 통과시킨다', () => {
      expectBytes(decodePercentEncodedPayload('=&/?'), [0x3d, 0x26, 0x2f, 0x3f]);
    });

    it('잘못된 hex escape는 invalid-percent로 거부한다', () => {
      expectImageProcessError(() => decodePercentEncodedPayload('%GG'), {
        code: 'INVALID_DATA_URL',
        kind: 'invalid-percent',
      });
      // payload 끝의 잘린 escape도 거부한다.
      expectImageProcessError(() => decodePercentEncodedPayload('%4'), {
        code: 'INVALID_DATA_URL',
        kind: 'invalid-percent',
      });
    });
  });

  describe('estimatePercentPayloadByteLength', () => {
    it('ASCII와 %XX는 각각 1 byte로 센다', () => {
      expect(estimatePercentPayloadByteLength('ABC')).toBe(3);
      expect(estimatePercentPayloadByteLength('%41%42')).toBe(2);
    });

    it('UTF-8 byte 길이 구간을 디코딩 없이 추정한다', () => {
      expect(estimatePercentPayloadByteLength('ñ')).toBe(2); // 0x80..0x7FF
      expect(estimatePercentPayloadByteLength('한')).toBe(3); // 0x800..0xFFFF
      expect(estimatePercentPayloadByteLength('😀')).toBe(4); // 0x10000..0x10FFFF
    });

    it('escape와 multi-byte 혼합 길이를 합산한다', () => {
      expect(estimatePercentPayloadByteLength('%FFA한😀')).toBe(1 + 1 + 3 + 4);
    });

    it('잘못된 hex escape는 invalid-percent로 거부한다', () => {
      expectImageProcessError(() => estimatePercentPayloadByteLength('%ZZ'), {
        code: 'INVALID_DATA_URL',
        kind: 'invalid-percent',
      });
    });
  });
});
