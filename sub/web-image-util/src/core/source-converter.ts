/**
 * 소스 변환기 - 다양한 이미지 소스를 HTMLImageElement로 변환
 */

import type { ImageSource, ProcessorOptions } from '../types';
import { ImageProcessError } from '../types';
import { normalizeSvgBasics } from '../utils/svg-compatibility';
import { extractSvgDimensions } from '../utils/svg-dimensions';
import { debugLog, productionLog } from '../utils/debug';
import type { QualityLevel } from './svg-complexity-analyzer';
import { analyzeSvgComplexity } from './svg-complexity-analyzer';

/**
 * 이미지 소스 타입
 *
 * @description 지원되는 이미지 소스의 타입들
 */
export type SourceType =
  | 'element'
  | 'canvas'
  | 'blob'
  | 'arrayBuffer'
  | 'uint8Array'
  | 'svg'
  | 'dataurl'
  | 'url'
  | 'bloburl'
  | 'path';

/**
 * UTF-8 BOM을 제거합니다
 * @param s 입력 문자열
 * @returns BOM이 제거된 문자열
 */
function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '');
}

/**
 * XML 프롤로그와 노이즈를 제거합니다
 * XML 선언, 주석, DOCTYPE, 공백을 건너뛴 후 실제 내용을 반환
 * @param head 분석할 문자열의 앞부분
 * @returns 정제된 문자열
 */
function stripXmlPreambleAndNoise(head: string): string {
  let s = head.trimStart();

  // XML 선언 제거: <?xml ...?>
  if (s.startsWith('<?xml')) {
    const end = s.indexOf('?>');
    if (end >= 0) s = s.slice(end + 2).trimStart();
  }

  // 주석 제거 (여러 개 연속 처리)
  // <!-- ... -->를 반복적으로 제거
  while (true) {
    const m = s.match(/^<!--[\s\S]*?-->\s*/);
    if (!m) break;
    s = s.slice(m[0].length);
  }

  // DOCTYPE 제거
  const doctype = s.match(/^<!DOCTYPE[^>]*>\s*/i);
  if (doctype) s = s.slice(doctype[0].length);

  return s.trimStart();
}

/**
 * 정확한 인라인 SVG 판정
 * BOM 제거 → 프롤로그 제거 → <svg 태그 확인
 * @param str 검사할 문자열
 * @returns SVG 여부
 */
function isInlineSvg(str: string): boolean {
  if (!str) return false;
  const stripped = stripXmlPreambleAndNoise(stripBom(str));
  return /^<svg[\s>]/i.test(stripped);
}

/**
 * Data URL이 SVG인지 확인
 * @param input 검사할 문자열
 * @returns SVG Data URL 여부
 */
function isDataUrlSvg(input: string): boolean {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(input);
}

/**
 * Blob의 앞부분을 텍스트로 읽어 SVG인지 스니핑
 * @param blob 검사할 Blob
 * @param bytes 읽을 바이트 수 (기본: 4096)
 * @returns SVG 여부
 */
async function sniffSvgFromBlob(blob: Blob, bytes = 4096): Promise<boolean> {
  try {
    const slice = await blob.slice(0, bytes).text();
    return isInlineSvg(slice);
  } catch {
    return false;
  }
}

/**
 * 이미지 소스 타입을 감지합니다
 *
 * @description 입력된 이미지 소스의 타입을 분석하여 적절한 변환 방법을 결정합니다.
 * @param source 분석할 이미지 소스
 * @returns 감지된 소스 타입
 */
export function detectSourceType(source: ImageSource): SourceType {
  if (source instanceof HTMLImageElement) {
    return 'element';
  }

  // HTMLCanvasElement 감지
  if (
    source instanceof HTMLCanvasElement ||
    (source &&
      typeof source === 'object' &&
      'getContext' in source &&
      'toDataURL' in source &&
      typeof (source as any).getContext === 'function')
  ) {
    return 'canvas';
  }

  // Blob 감지 - instanceof와 덕 타이핑 둘 다 사용
  if (
    source instanceof Blob ||
    (source &&
      typeof source === 'object' &&
      'type' in source &&
      'size' in source &&
      ('slice' in source || 'arrayBuffer' in source))
  ) {
    // SVG 파일 감지
    if (source.type === 'image/svg+xml' || (source as File).name?.endsWith('.svg')) {
      return 'svg';
    }
    return 'blob';
  }

  if (source instanceof ArrayBuffer) {
    return 'arrayBuffer';
  }

  if (source instanceof Uint8Array) {
    return 'uint8Array';
  }

  if (typeof source === 'string') {
    const trimmed = source.trim();

    // Data URL SVG 감지 (우선순위 - 일반 Data URL보다 먼저 체크)
    if (isDataUrlSvg(trimmed)) {
      return 'svg';
    }

    // 인라인 SVG XML 감지 (정확한 검사)
    if (isInlineSvg(trimmed)) {
      return 'svg';
    }

    // 기타 Data URL 감지
    if (trimmed.startsWith('data:')) {
      return 'dataurl';
    }

    // HTTP/HTTPS URL 감지
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Content-Type 기반 판정은 실제 로딩 시점에서 수행
      // 여기서는 확장자를 힌트로만 사용
      try {
        const url = new URL(trimmed);
        if (url.pathname.toLowerCase().endsWith('.svg')) {
          return 'svg';
        }
      } catch {
        // URL 파싱 실패 시 문자열 기반 검사로 폴백
        if (trimmed.toLowerCase().endsWith('.svg')) {
          return 'svg';
        }
      }
      return 'url';
    }

    // Blob URL 감지 (createObjectURL로 생성된 URL)
    if (trimmed.startsWith('blob:')) {
      return 'bloburl';
    }

    // 파일 경로 - SVG 확장자 체크
    if (trimmed.toLowerCase().endsWith('.svg')) {
      return 'svg';
    }

    // 나머지는 파일 경로로 취급
    return 'path';
  }

  throw new ImageProcessError(`지원하지 않는 소스 타입입니다: ${typeof source}`, 'INVALID_SOURCE');
}

/**
 * Data URL에서 SVG 문자열을 추출하고 검증합니다
 * @param dataUrl SVG Data URL
 * @returns 파싱되고 검증된 SVG 문자열
 */
function parseSvgFromDataUrl(dataUrl: string): string {
  // data:image/svg+xml;base64,<base64-data> 형태
  // data:image/svg+xml;charset=utf-8,<url-encoded-data> 형태
  // data:image/svg+xml,<svg-content> 형태

  const [header, content] = dataUrl.split(',');
  if (!content) {
    throw new ImageProcessError('유효하지 않은 SVG Data URL 형식입니다', 'INVALID_SOURCE');
  }

  let svgContent: string;

  // base64 인코딩된 경우
  if (header.includes('base64')) {
    try {
      svgContent = atob(content);
    } catch (error) {
      throw new ImageProcessError('Base64 SVG 디코딩에 실패했습니다', 'SOURCE_LOAD_FAILED', error as Error);
    }
  } else {
    // URL 인코딩된 경우
    try {
      svgContent = decodeURIComponent(content);
    } catch (error) {
      // 디코딩 실패 시 원본 콘텐츠 사용
      svgContent = content;
    }
  }

  // 디코딩된 내용이 실제로 SVG인지 검증
  if (!isInlineSvg(svgContent)) {
    throw new ImageProcessError('Data URL 내용이 유효한 SVG가 아닙니다', 'INVALID_SOURCE');
  }

  return svgContent;
}

/**
 * 문자열 소스를 HTMLImageElement로 변환
 */
async function convertStringToElement(source: string, options?: ProcessorOptions): Promise<HTMLImageElement> {
  const sourceType = detectSourceType(source);

  switch (sourceType) {
    case 'svg':
      // SVG 문자열, Data URL SVG, HTTP URL SVG 처리
      if (typeof source === 'string') {
        // Data URL SVG인 경우 파싱
        if (isDataUrlSvg(source.trim())) {
          const svgContent = parseSvgFromDataUrl(source);
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // HTTP URL SVG인 경우 로드 후 처리
        else if (source.trim().startsWith('http://') || source.trim().startsWith('https://')) {
          // URL에서 SVG 내용을 로드
          const response = await fetch(source);
          if (!response.ok) {
            throw new ImageProcessError(`SVG URL 로드 실패: ${response.status}`, 'SOURCE_LOAD_FAILED');
          }
          const svgContent = await response.text();
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // 파일 경로 SVG인 경우 로드 후 처리
        else if (source.trim().toLowerCase().endsWith('.svg')) {
          // 파일 경로에서 SVG 내용을 로드
          const response = await fetch(source);
          if (!response.ok) {
            throw new ImageProcessError(`SVG 파일 로드 실패: ${response.status}`, 'SOURCE_LOAD_FAILED');
          }
          const svgContent = await response.text();
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // 일반 SVG 문자열
        else {
          return convertSvgToElement(source, undefined, undefined, {
            quality: 'auto',
          });
        }
      } else {
        // SVG Blob/File을 문자열로 변환 후 처리
        const svgText = await (source as Blob).text();
        return convertSvgToElement(svgText, undefined, undefined, {
          quality: 'auto',
          crossOrigin: options?.crossOrigin,
        });
      }
    case 'dataurl':
    case 'url':
    case 'path':
      return loadImageFromUrl(source, options?.crossOrigin, options);
    case 'bloburl':
      return loadBlobUrl(source, options);
    default:
      throw new ImageProcessError(`변환할 수 없는 문자열 소스입니다: ${sourceType}`, 'INVALID_SOURCE');
  }
}

// SVG 정규화는 브라우저 호환성을 위해 svg-compatibility 모듈에서 처리

/**
 * SVG 문자열을 Base64 Data URL로 변환
 * @param svgString SVG 문자열
 * @returns Base64 인코딩된 Data URL
 */
function createBase64DataUrl(svgString: string): string {
  try {
    // UTF-8 안전한 Base64 인코딩
    const base64 = btoa(
      Array.from(new TextEncoder().encode(svgString))
        .map((byte) => String.fromCharCode(byte))
        .join('')
    );
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    // Base64 인코딩 실패 시 URL 인코딩 폴백
    const encoded = encodeURIComponent(svgString);
    return `data:image/svg+xml,${encoded}`;
  }
}

/**
 * SVG 고품질 렌더링 옵션
 */
interface SvgRenderingOptions {
  /** 품질 레벨 또는 자동 선택 */
  quality?: QualityLevel | 'auto';
  /** CORS 설정 */
  crossOrigin?: string;
}

/**
 * SVG 문자열을 HTMLImageElement로 변환 (고품질 렌더링)
 *
 * **🎨 품질 개선:**
 * - SVG 원본을 그대로 유지하고 Canvas에서 직접 타겟 크기로 렌더링
 * - Canvas를 처음부터 목표 크기로 생성하여 벡터 품질 완전 보존
 * - 불필요한 중간 래스터화 단계 제거로 성능 및 메모리 효율 향상
 *
 * @param svgString - 변환할 SVG 문자열
 * @param targetWidth - 목표 너비 (선택적)
 * @param targetHeight - 목표 높이 (선택적)
 * @param options - 고품질 렌더링 옵션
 * @returns 고품질로 처리된 HTMLImageElement
 */
async function convertSvgToElement(
  svgString: string,
  targetWidth?: number,
  targetHeight?: number,
  options?: SvgRenderingOptions
): Promise<HTMLImageElement> {
  try {
    // 1. SVG 정규화 처리
    const normalizedSvg = normalizeSvgBasics(svgString);

    // 2. SVG 크기 정보 추출
    const dimensions = extractSvgDimensions(normalizedSvg);

    // 3. 목표 크기 결정
    const finalWidth = targetWidth || dimensions.width;
    const finalHeight = targetHeight || dimensions.height;

    // 4. 품질 레벨 결정 (자동 또는 명시적)
    let qualityLevel: QualityLevel = 'medium';
    if (options?.quality === 'auto' || !options?.quality) {
      const complexityResult = analyzeSvgComplexity(normalizedSvg);
      qualityLevel = complexityResult.recommendedQuality;
    } else {
      qualityLevel = options.quality;
    }

    // 5. 최종 렌더링 크기 = 목표 크기 (scaleFactor 제거)
    // SVG는 벡터이므로 어떤 크기로 렌더링해도 선명함 보장
    // 불필요한 확대 후 축소 과정을 제거하여 화질 보존
    const renderWidth = finalWidth;
    const renderHeight = finalHeight;

    debugLog.log('🔧 convertSvgToElement 직접 렌더링:', {
      originalDimensions: `${dimensions.width}x${dimensions.height}`,
      targetDimensions: `${finalWidth}x${finalHeight}`,
      qualityLevel,
      renderDimensions: `${renderWidth}x${renderHeight}`,
      hasExplicitSize: dimensions.hasExplicitSize,
      viewBox: dimensions.viewBox,
      timestamp: Date.now(),
    });

    // 7. SVG 원본 크기 유지 (벡터 품질 보존)
    // setSvgDimensions를 사용하지 않고 normalizedSvg를 그대로 사용하여
    // Canvas에서 직접 타겟 크기로 렌더링함으로써 벡터 품질을 보존합니다.
    const enhancedSvg = normalizedSvg;

    // 8. 최적화된 Image 생성 (하이브리드 방식)
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      let objectUrl: string | null = null;

      // 성공 핸들러
      img.onload = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl); // 메모리 해제
        }
        resolve(img);
      };

      // 에러 핸들러 - 복구 시도 포함
      img.onerror = (error) => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl); // 에러 시에도 메모리 해제
        }
        reject(
          new ImageProcessError(
            `SVG 로드 실패: 품질 레벨 ${qualityLevel}, 크기 ${renderWidth}x${renderHeight}, 오류: ${error}`,
            'SOURCE_LOAD_FAILED'
          )
        );
      };

      // SVG 크기에 따른 하이브리드 방식 선택
      const svgSize = new Blob([enhancedSvg]).size;
      const SIZE_THRESHOLD = 50 * 1024; // 50KB 기준

      if (svgSize > SIZE_THRESHOLD) {
        // 큰 SVG: Blob URL 방식 (메모리 효율적)
        try {
          const blob = new Blob([enhancedSvg], { type: 'image/svg+xml' });
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        } catch (blobError) {
          // Blob 생성 실패 시 Base64 폴백
          productionLog.warn('Blob URL 생성 실패, Base64로 폴백:', blobError);
          img.src = createBase64DataUrl(enhancedSvg);
        }
      } else {
        // 작은 SVG: Base64 방식 (더 빠름)
        img.src = createBase64DataUrl(enhancedSvg);
      }

      // 🚀 고품질 이미지 디코딩 설정
      img.decoding = 'async';

      // 크로스 오리진 설정 (필요시)
      if (options?.crossOrigin) {
        img.crossOrigin = options.crossOrigin;
      }
    });
  } catch (error) {
    throw new ImageProcessError(
      `SVG 처리 실패: ${error instanceof Error ? error.message : error}`,
      'SOURCE_LOAD_FAILED'
    );
  }
}

/**
 * Blob URL에서 이미지를 로드하여 HTMLImageElement로 변환
 * Content-Type 우선 확인 및 이중 검증으로 SVG 처리 적용
 */
async function loadBlobUrl(blobUrl: string, options?: ProcessorOptions): Promise<HTMLImageElement> {
  try {
    // Blob URL에서 Content-Type 및 내용 확인
    const response = await fetch(blobUrl);

    if (!response.ok) {
      throw new ImageProcessError(`Blob URL 로드 실패: ${response.status}`, 'SOURCE_LOAD_FAILED');
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    const blob = await response.blob();

    // 1차: Content-Type 기반 SVG 판정
    const isSvgMime = contentType.includes('image/svg+xml');

    // 2차: MIME이 비어있거나 XML 계열인 경우 내용 스니핑
    const isEmptyMime = !contentType;
    const isXmlMime = contentType.includes('text/xml') || contentType.includes('application/xml');

    if (isSvgMime || isEmptyMime || isXmlMime) {
      const isSvgContent = await sniffSvgFromBlob(blob);

      // SVG MIME이거나 내용 스니핑에서 SVG가 확인된 경우
      if (isSvgMime || isSvgContent) {
        const svgContent = await blob.text();
        return convertSvgToElement(svgContent, undefined, undefined, {
          quality: 'auto',
        });
      }
    }

    // SVG가 아닌 경우 기본 Image 로딩
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new ImageProcessError(`Blob URL 이미지 로딩에 실패했습니다: ${blobUrl}`, 'SOURCE_LOAD_FAILED'));
      img.src = blobUrl;
    });
  } catch (error) {
    throw new ImageProcessError('Blob URL 처리 중 오류가 발생했습니다', 'SOURCE_LOAD_FAILED', error as Error);
  }
}

/**
 * URL에서 이미지를 로드하여 HTMLImageElement로 변환
 * Content-Type 우선 확인 및 이중 검증으로 SVG 처리 적용
 */
async function loadImageFromUrl(
  url: string,
  crossOrigin?: string,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  try {
    // HTTP/HTTPS URL인 경우 Content-Type을 우선적으로 확인
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        // 한 번의 GET 요청으로 Content-Type 확인 및 내용 로드
        const response = await fetch(url, {
          method: 'GET',
          mode: crossOrigin ? 'cors' : 'same-origin',
        });

        if (!response.ok) {
          throw new ImageProcessError(`URL 로드 실패: ${response.status}`, 'SOURCE_LOAD_FAILED');
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() || '';

        // 1차: Content-Type 기반 SVG 판정
        const isSvgMime = contentType.includes('image/svg+xml');

        // 2차: XML 계열 MIME에 대한 내용 스니핑
        const isXmlMime = contentType.includes('text/xml') || contentType.includes('application/xml');

        if (isSvgMime || isXmlMime) {
          const responseText = await response.text();

          // SVG MIME이거나 XML MIME에서 실제 SVG 내용이 확인된 경우
          if (isSvgMime || (isXmlMime && isInlineSvg(responseText))) {
            return convertSvgToElement(responseText, undefined, undefined, {
              quality: 'auto',
              crossOrigin: options?.crossOrigin,
            });
          }
        }

        // SVG가 아닌 경우 기본 Image 로딩으로 폴백
        // Response 스트림이 이미 소비되었으므로 URL로 새 Image 생성
      } catch (fetchError) {
        // fetch 실패 시 기본 Image 로딩으로 폴백
        productionLog.warn('Content-Type 확인 실패, 기본 이미지 로딩으로 폴백:', fetchError);
      }
    }

    // 기본 Image 로딩 방식
    return new Promise((resolve, reject) => {
      const img = new Image();

      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }

      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImageProcessError(`이미지 로딩에 실패했습니다: ${url}`, 'SOURCE_LOAD_FAILED'));

      img.src = url;
    });
  } catch (error) {
    throw new ImageProcessError('URL 이미지 로딩 중 오류가 발생했습니다', 'SOURCE_LOAD_FAILED', error as Error);
  }
}

/**
 * ArrayBuffer에서 MIME 타입을 자동 감지합니다
 *
 * @param buffer ArrayBuffer 데이터
 * @returns 감지된 MIME 타입
 */
function detectMimeTypeFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // PNG 시그니처: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG 시그니처: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP 시그니처: RIFF ... WEBP (파일 헤더 확인)
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // WEBP 시그니처 확인 (8-11 바이트)
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }

  // GIF 시그니처: GIF87a 또는 GIF89a
  if (bytes.length >= 6) {
    const gifSignature = String.fromCharCode(...bytes.slice(0, 3));
    if (gifSignature === 'GIF') {
      const version = String.fromCharCode(...bytes.slice(3, 6));
      if (version === '87a' || version === '89a') {
        return 'image/gif';
      }
    }
  }

  // BMP 시그니처: BM
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  // TIFF 시그니처: II* (little-endian) 또는 MM* (big-endian)
  if (bytes.length >= 4) {
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
    ) {
      return 'image/tiff';
    }
  }

  // ICO 시그니처: 00 00 01 00
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }

  // 기본값으로 PNG 반환
  return 'image/png';
}

/**
 * HTMLCanvasElement를 HTMLImageElement로 변환
 */
async function convertCanvasToElement(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const dataURL = canvas.toDataURL();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageProcessError('Canvas 이미지 로딩에 실패했습니다', 'SOURCE_LOAD_FAILED'));

    img.src = dataURL;
  });
}

/**
 * Blob을 HTMLImageElement로 변환 (SVG 고품질 처리 포함)
 */
async function convertBlobToElement(blob: Blob, options?: ProcessorOptions): Promise<HTMLImageElement> {
  // SVG Blob인 경우 고품질 처리
  if (blob.type === 'image/svg+xml' || (blob as File).name?.endsWith('.svg')) {
    const svgText = await blob.text();
    return convertSvgToElement(svgText, undefined, undefined, {
      quality: 'auto',
    });
  }

  // 일반 Blob 처리
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImageProcessError('Blob 이미지 로딩에 실패했습니다', 'SOURCE_LOAD_FAILED'));
    };

    img.src = objectUrl;
  });
}

/**
 * 모든 ImageSource를 HTMLImageElement로 변환하는 메인 함수
 *
 * @description 다양한 타입의 이미지 소스를 HTMLImageElement로 통일된 형태로 변환합니다.
 * HTMLImageElement, Blob, 문자열(URL, SVG, Data URL) 등을 지원합니다.
 * @param source 변환할 이미지 소스
 * @param options 변환 옵션 (CORS 설정 등)
 * @returns HTMLImageElement 객체
 */
export async function convertToImageElement(
  source: ImageSource,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  try {
    if (source instanceof HTMLImageElement) {
      // 이미 로드된 이미지인지 확인
      if (source.complete && source.naturalWidth > 0) {
        return source;
      }

      // 로딩이 완료될 때까지 대기
      return new Promise((resolve, reject) => {
        if (source.complete && source.naturalWidth > 0) {
          resolve(source);
        } else {
          source.onload = () => resolve(source);
          source.onerror = () =>
            reject(new ImageProcessError('HTMLImageElement 로딩에 실패했습니다', 'SOURCE_LOAD_FAILED'));
        }
      });
    }

    // HTMLCanvasElement 처리
    if (
      source instanceof HTMLCanvasElement ||
      (source && typeof source === 'object' && 'getContext' in source && 'toDataURL' in source)
    ) {
      return convertCanvasToElement(source as HTMLCanvasElement);
    }

    // Blob 감지 - instanceof와 덕 타이핑 둘 다 사용
    if (
      source instanceof Blob ||
      (source &&
        typeof source === 'object' &&
        'type' in source &&
        'size' in source &&
        ('slice' in source || 'arrayBuffer' in source))
    ) {
      return convertBlobToElement(source as Blob, options);
    }

    if (source instanceof ArrayBuffer) {
      const mimeType = detectMimeTypeFromBuffer(source);
      const blob = new Blob([source], { type: mimeType });
      return convertBlobToElement(blob, options);
    }

    if (source instanceof Uint8Array) {
      // Uint8Array를 ArrayBuffer로 안전하게 변환
      const arrayBuffer =
        source.buffer instanceof ArrayBuffer
          ? source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
          : source.slice().buffer;
      const mimeType = detectMimeTypeFromBuffer(arrayBuffer);
      const blob = new Blob([arrayBuffer], { type: mimeType });
      return convertBlobToElement(blob, options);
    }

    if (typeof source === 'string') {
      return convertStringToElement(source, options);
    }

    throw new ImageProcessError(`지원하지 않는 소스 타입입니다: ${typeof source}`, 'INVALID_SOURCE');
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError('소스 변환 중 알 수 없는 오류가 발생했습니다', 'SOURCE_LOAD_FAILED', error as Error);
  }
}

/**
 * 이미지 소스의 크기 정보를 얻습니다
 *
 * @description 다양한 이미지 소스로부터 실제 크기 정보를 추출합니다.
 * @param source 크기를 알고 싶은 이미지 소스
 * @returns 이미지의 너비와 높이 정보
 */
export async function getImageDimensions(source: ImageSource): Promise<{
  width: number;
  height: number;
}> {
  const element = await convertToImageElement(source);
  return {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}
