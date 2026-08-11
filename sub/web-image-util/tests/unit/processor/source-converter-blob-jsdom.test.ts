/**
 * Blob/ArrayBuffer source-converter 행동 보강 테스트.
 *
 * convertToImageElement의 Blob/File/ArrayBuffer/Uint8Array 경로가
 * SVG 스니핑을 우회하지 못하고 올바른 loader로 진입함을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// svg/loader를 mock해 convertSvgToElement 호출 여부를 spy한다.
// vi.mock은 import 문보다 앞으로 자동 hoisting된다.
vi.mock('../../../src/core/source-converter/svg/loader.internal', () => ({
  convertSvgToElement: vi.fn(),
}));

import { convertToImageElement } from '../../../src/core/source-converter/index';
import { detectMimeTypeFromBuffer } from '../../../src/core/source-converter/loaders/blob.internal';
import { convertSvgToElement } from '../../../src/core/source-converter/svg/loader.internal';
import { ImageProcessError } from '../../../src/types';

/** 스니핑 판정에 충분한 최소 SVG 문자열 (ASCII 범위) */
const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';

/**
 * ASCII 문자열을 jsdom vm 컨텍스트의 Uint8Array로 변환한다.
 *
 * vitest jsdom 환경에서 TextEncoder.encode()는 Node.js 내부 realm의 Uint8Array를
 * 반환하므로 instanceof Uint8Array 검사가 실패한다. new Uint8Array()를 직접 사용하면
 * jsdom 컨텍스트의 생성자를 사용하므로 instanceof 검사가 올바르게 동작한다.
 */
function asciiToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    arr[i] = str.charCodeAt(i);
  }
  return arr;
}

/**
 * document.createElement('img')를 가상 객체로 교체해 jsdom의 리소스 로딩을 차단한다.
 *
 * jsdom은 blob: URL을 로드하지 못해 img.src 설정 시 자동으로 onerror를 발생시킨다.
 * 가상 img 객체는 src setter에서 원하는 이벤트를 queueMicrotask로 트리거한다.
 */
function mockImgLoad(trigger: 'load' | 'error'): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'img') return origCreate(tag as any);

    let onload: EventListener | null = null;
    let onerror: EventListener | null = null;
    const fakeImg = {
      get onload() {
        return onload;
      },
      set onload(v: EventListener | null) {
        onload = v;
      },
      get onerror() {
        return onerror;
      },
      set onerror(v: EventListener | null) {
        onerror = v;
      },
      get src() {
        return '';
      },
      set src(_v: string) {
        queueMicrotask(() => {
          if (trigger === 'load' && onload) onload(new Event('load'));
          else if (trigger === 'error' && onerror) onerror(new Event('error'));
        });
      },
    };
    return fakeImg as unknown as HTMLImageElement;
  });
}

// ── detectMimeTypeFromBuffer 단위 검증 ────────────────────────────────────

describe('detectMimeTypeFromBuffer — 바이너리 시그니처 판정', () => {
  it('PNG 시그니처(89 50 4E 47 0D 0A 1A 0A)를 image/png로 판정한다', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/png');
  });

  it('JPEG 시그니처(FF D8 FF)를 image/jpeg로 판정한다', () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0x00]).buffer;
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/jpeg');
  });

  it('WebP 시그니처(RIFF....WEBP)를 image/webp로 판정한다', () => {
    const buf = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x00,
      0x00,
      0x00,
      0x00, // 파일 크기(임의)
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
    ]).buffer;
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/webp');
  });

  it('GIF89a 시그니처를 image/gif로 판정한다', () => {
    const buf = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer; // GIF89a
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/gif');
  });

  it('GIF87a 시그니처를 image/gif로 판정한다', () => {
    const buf = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]).buffer; // GIF87a
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/gif');
  });

  it('BMP 시그니처(42 4D)를 image/bmp로 판정한다', () => {
    const buf = new Uint8Array([0x42, 0x4d, 0x00, 0x00]).buffer; // BM
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/bmp');
  });

  it('TIFF little-endian 시그니처(49 49 2A 00)를 image/tiff로 판정한다', () => {
    const buf = new Uint8Array([0x49, 0x49, 0x2a, 0x00]).buffer; // II*\0
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/tiff');
  });

  it('TIFF big-endian 시그니처(4D 4D 00 2A)를 image/tiff로 판정한다', () => {
    const buf = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]).buffer; // MM\0*
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/tiff');
  });

  it('ICO 시그니처(00 00 01 00)를 image/x-icon으로 판정한다', () => {
    const buf = new Uint8Array([0x00, 0x00, 0x01, 0x00]).buffer;
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/x-icon');
  });

  it('SVG XML 본문을 image/svg+xml로 판정한다', () => {
    // detectMimeTypeFromBuffer 내부에서 new Uint8Array(buffer)로 바이트를 읽으므로
    // Node.js TextEncoder buffer도 정상 동작한다.
    const buf = new TextEncoder().encode(MINIMAL_SVG).buffer as ArrayBuffer;
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/svg+xml');
  });

  it('알 수 없는 바이트 시퀀스는 image/png를 기본값으로 반환한다', () => {
    const buf = new Uint8Array([0x01, 0x02, 0x03, 0x04]).buffer;
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/png');
  });

  // ── 이슈 6: 짧은 버퍼/경계 가드 검증 ────────────────────────────────────

  it('0바이트 버퍼는 모든 시그니처 가드를 통과하지 못해 기본값 image/png를 반환한다', () => {
    // 시그니처 매치가 아닌 기본값 폴백임을 명시적으로 단정한다.
    expect(detectMimeTypeFromBuffer(new ArrayBuffer(0))).toBe('image/png');
  });

  it('7바이트 PNG prefix는 length>=8 가드 실패로 시그니처 매치 없이 기본값 image/png를 반환한다', () => {
    // PNG 시그니처는 8바이트 전부 일치해야 한다. 7바이트는 가드 실패 → 기본값 폴백.
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]).buffer;
    expect(detectMimeTypeFromBuffer(buf)).toBe('image/png');
  });
});

// ── Blob SVG 스니핑 — convertSvgToElement 경로 검증 ─────────────────────

describe('Blob SVG 스니핑 및 변환 경로', () => {
  beforeEach(() => {
    // SVG 변환 호출을 가로채 HTMLImageElement를 즉시 반환한다.
    vi.mocked(convertSvgToElement).mockImplementation(() => Promise.resolve(document.createElement('img')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(convertSvgToElement).mockReset();
  });

  it('MIME이 비어 있는 SVG Blob은 SVG 변환 경로를 타고 createObjectURL을 사용하지 않는다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    const blob = new Blob([MINIMAL_SVG], { type: '' });
    await convertToImageElement(blob);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    // 이슈 1: 첫 번째 인자(SVG 본문)와 네 번째 인자(옵션)를 단정한다.
    const call = vi.mocked(convertSvgToElement).mock.calls[0];
    expect(call[0]).toBe(MINIMAL_SVG);
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('.svg 확장자 File은 본문 스니핑 없이 SVG 변환 경로로 진입한다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    const file = new File([MINIMAL_SVG], 'icon.svg', { type: '' });
    await convertToImageElement(file);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(convertSvgToElement).mock.calls[0];
    expect(call[0]).toBe(MINIMAL_SVG);
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('application/xml MIME Blob은 본문 스니핑 후 SVG 변환 경로로 진입한다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    const blob = new Blob([MINIMAL_SVG], { type: 'application/xml' });
    await convertToImageElement(blob);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(convertSvgToElement).mock.calls[0];
    expect(call[0]).toBe(MINIMAL_SVG);
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  // 이슈 2: text/xml 분기 검증
  it('text/xml MIME Blob은 본문 스니핑 후 SVG 변환 경로로 진입한다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    const blob = new Blob([MINIMAL_SVG], { type: 'text/xml' });
    await convertToImageElement(blob);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(convertSvgToElement).mock.calls[0];
    expect(call[0]).toBe(MINIMAL_SVG);
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  // 이슈 2: 대소문자 혼합 MIME — normalizedType.toLowerCase()로 정규화되는 계약 검증
  it('대소문자 혼합 Application/XML MIME Blob은 정규화 후 SVG 변환 경로로 진입한다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    const blob = new Blob([MINIMAL_SVG], { type: 'Application/XML' });
    await convertToImageElement(blob);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(convertSvgToElement).mock.calls[0];
    expect(call[0]).toBe(MINIMAL_SVG);
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('image/svg+xml MIME Blob은 SVG 변환 경로로 진입한다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    const blob = new Blob([MINIMAL_SVG], { type: 'image/svg+xml' });
    await convertToImageElement(blob);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(convertSvgToElement).mock.calls[0];
    expect(call[0]).toBe(MINIMAL_SVG);
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });
});

// ── Blob SVG 스니핑 — 음성 케이스 ──────────────────────────────────────────

describe('Blob SVG 스니핑 — 음성 케이스 (비-SVG XML은 SVG 경로를 타지 않는다)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(convertSvgToElement).mockReset();
  });

  // 이슈 3: SVG 본문 스니핑 대칭 — 비-SVG XML이 SVG 경로로 진입하는 회귀를 감지한다.
  it('application/xml MIME이지만 SVG 본문이 아닌 Blob은 SVG 경로를 타지 않는다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-xml');
    vi.spyOn(URL, 'revokeObjectURL');
    mockImgLoad('load');

    const blob = new Blob(['<note><body>hi</body></note>'], { type: 'application/xml' });
    await convertToImageElement(blob);

    expect(vi.mocked(convertSvgToElement)).not.toHaveBeenCalled();
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
  });

  it('text/xml MIME이지만 SVG 본문이 아닌 Blob은 SVG 경로를 타지 않는다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-textxml');
    vi.spyOn(URL, 'revokeObjectURL');
    mockImgLoad('load');

    const blob = new Blob(['<note><body>hi</body></note>'], { type: 'text/xml' });
    await convertToImageElement(blob);

    expect(vi.mocked(convertSvgToElement)).not.toHaveBeenCalled();
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
  });
});

// ── PNG Blob — URL 정리 계약 ─────────────────────────────────────────────

describe('PNG Blob — URL 정리 계약', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('이미지 로드 성공 시 createObjectURL과 revokeObjectURL이 쌍으로 호출된다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-success-url');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL');

    // 가상 img 객체로 교체해 jsdom의 자동 onerror를 차단하고 onload를 수동 트리거한다.
    mockImgLoad('load');

    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    await convertToImageElement(pngBlob);

    expect(createObjectUrlSpy).toHaveBeenCalledWith(pngBlob);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-success-url');
  });

  it('이미지 로드 실패 시에도 revokeObjectURL이 호출된다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-error-url');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL');

    // 가상 img 객체로 교체해 onerror를 수동 트리거한다.
    mockImgLoad('error');

    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    await expect(convertToImageElement(pngBlob)).rejects.toBeInstanceOf(ImageProcessError);

    expect(createObjectUrlSpy).toHaveBeenCalledWith(pngBlob);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-error-url');
  });

  it('maxSourceBytes 초과 시 SOURCE_BYTES_EXCEEDED 코드와 actualBytes/maxBytes details를 가진 오류를 던진다', async () => {
    const pngBlob = new Blob([new Uint8Array(10)], { type: 'image/png' });

    let caught: unknown;
    try {
      await convertToImageElement(pngBlob, { maxSourceBytes: 5 });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ImageProcessError);
    const err = caught as ImageProcessError;
    expect(err.code).toBe('SOURCE_BYTES_EXCEEDED');
    expect(err.details?.actualBytes).toBe(10);
    expect(err.details?.maxBytes).toBe(5);
  });

  // 이슈 4: maxSourceBytes 임계치 경계 — ±1 및 비활성 케이스 검증

  it('Blob 크기가 maxSourceBytes와 정확히 같으면 허용된다(경계 동등)', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-boundary');
    vi.spyOn(URL, 'revokeObjectURL');
    mockImgLoad('load');

    const pngBlob = new Blob([new Uint8Array(5)], { type: 'image/png' });
    await expect(convertToImageElement(pngBlob, { maxSourceBytes: 5 })).resolves.toBeDefined();
  });

  it('Blob 크기가 maxSourceBytes보다 1 크면 거부된다(경계 초과)', async () => {
    const pngBlob = new Blob([new Uint8Array(6)], { type: 'image/png' });

    await expect(convertToImageElement(pngBlob, { maxSourceBytes: 5 })).rejects.toMatchObject({
      code: 'SOURCE_BYTES_EXCEEDED',
    });
  });

  it('maxSourceBytes가 0이면 크기 제한이 비활성화되어 큰 Blob도 허용된다', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-no-limit');
    vi.spyOn(URL, 'revokeObjectURL');
    mockImgLoad('load');

    // maxBytes=0은 조건 `maxBytes > 0`을 충족하지 않아 크기 검사를 건너뛴다.
    const pngBlob = new Blob([new Uint8Array(10000)], { type: 'image/png' });
    await expect(convertToImageElement(pngBlob, { maxSourceBytes: 0 })).resolves.toBeDefined();
  });
});

// ── ArrayBuffer / Uint8Array 입력 — MIME 감지 및 재포장 검증 ─────────────

describe('ArrayBuffer / Uint8Array 입력 경로', () => {
  beforeEach(() => {
    vi.mocked(convertSvgToElement).mockImplementation(() => Promise.resolve(document.createElement('img')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(convertSvgToElement).mockReset();
  });

  it('PNG ArrayBuffer는 image/png Blob으로 재포장되어 createObjectURL 경로를 사용한다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-png-ab');
    vi.spyOn(URL, 'revokeObjectURL');
    mockImgLoad('load');

    // jsdom 컨텍스트의 Uint8Array.buffer를 직접 사용한다.
    const pngBuf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    await convertToImageElement(pngBuf);

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectUrlSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('image/png');
    expect(vi.mocked(convertSvgToElement)).not.toHaveBeenCalled();
  });

  it('SVG XML ArrayBuffer는 image/svg+xml Blob으로 재포장되어 SVG 변환 경로를 사용한다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    // TextEncoder.encode().buffer는 Node.js realm 타입이라 instanceof ArrayBuffer가 실패한다.
    // jsdom 컨텍스트의 new Uint8Array()로 직접 생성한 buffer를 사용한다.
    const svgBuf = asciiToUint8Array(MINIMAL_SVG).buffer;
    await convertToImageElement(svgBuf);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    // 이슈 1: SVG 본문이 첫 번째 인자로 전달되는지 단정한다.
    const call = vi.mocked(convertSvgToElement).mock.calls[0];
    expect(call[0]).toBe(MINIMAL_SVG);
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('PNG Uint8Array는 ArrayBuffer와 동일하게 image/png Blob으로 재포장된다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-png-u8');
    vi.spyOn(URL, 'revokeObjectURL');
    mockImgLoad('load');

    const pngUint8 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await convertToImageElement(pngUint8);

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectUrlSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('image/png');
    expect(vi.mocked(convertSvgToElement)).not.toHaveBeenCalled();
  });

  it('SVG XML Uint8Array는 SVG 변환 경로로 진입한다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    // jsdom 컨텍스트의 new Uint8Array()로 직접 생성해 instanceof Uint8Array가 올바르게 동작하게 한다.
    const svgUint8 = asciiToUint8Array(MINIMAL_SVG);
    await convertToImageElement(svgUint8);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(convertSvgToElement).mock.calls[0];
    expect(call[0]).toBe(MINIMAL_SVG);
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto' }));
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  // 이슈 5: byteOffset이 있는 Uint8Array — 슬라이스 보정 경로 검증
  it('byteOffset이 있는 Uint8Array는 올바른 영역만 MIME 감지에 사용된다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-offset-png');
    vi.spyOn(URL, 'revokeObjectURL');
    mockImgLoad('load');

    // 16바이트 버퍼를 만든다.
    // 처음 4바이트는 JPEG 시그니처(잘못된 범위를 보면 image/jpeg로 감지됨).
    // 4번 오프셋부터 PNG 시그니처 8바이트를 배치한다.
    const big = new Uint8Array(16);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    big[3] = 0x00; // JPEG
    big[4] = 0x89;
    big[5] = 0x50;
    big[6] = 0x4e;
    big[7] = 0x47; // PNG 앞
    big[8] = 0x0d;
    big[9] = 0x0a;
    big[10] = 0x1a;
    big[11] = 0x0a; // PNG 뒤

    // byteOffset=4인 뷰는 PNG 시그니처 구간만 노출한다.
    // slice(byteOffset, byteOffset+byteLength) 보정이 없으면 전체 버퍼를 읽어 image/jpeg로 감지된다.
    const view = new Uint8Array(big.buffer, 4, 8);
    await convertToImageElement(view);

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectUrlSpy.mock.calls[0][0] as Blob;
    // byteOffset 보정이 올바르게 동작하면 PNG 시그니처가 감지되어 image/png가 된다.
    expect(blobArg.type).toBe('image/png');
    expect(vi.mocked(convertSvgToElement)).not.toHaveBeenCalled();
  });
});
