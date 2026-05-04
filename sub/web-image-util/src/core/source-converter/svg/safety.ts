/**
 * SVG 입력 안전성 검사를 모은 모듈이다.
 *
 * 크기 한도 검사, 콘텐츠 화이트리스트 검사, 그리고 fetch 응답 본문을 fail-closed
 * 정책으로 검증하는 헬퍼를 제공한다.
 */

import { ImageProcessError } from '../../../types';
import { isInlineSvg } from '../../../utils/svg-detection';
import { getCssPolicyValueVariants, visitCssUrlValues } from '../../../utils/svg-policy-utils';
import { MAX_SVG_BYTES } from '../options';
import { isBlockedSvgPolicyRef } from '../url/policy';

/**
 * 따옴표 안의 `>` 문자를 태그 종료로 오인하지 않도록 SVG 시작 태그를 순회하는 패턴이다.
 */
const SVG_START_TAG_PATTERN = /<([a-z][a-z0-9:-]*)(\b(?:[^"'<>]|"[^"]*"|'[^']*')*)(\/?)>/gi;

/**
 * 문자열의 UTF-8 인코딩 바이트 수를 계산한다.
 *
 * @param value 크기를 계산할 문자열
 * @returns UTF-8 기준 바이트 수
 */
function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * SVG 입력 크기 제한 초과 에러를 생성한다.
 *
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 * @param actualBytes 실제 입력 바이트 수
 * @param maxBytes 최대 허용 바이트 수 (기본값: MAX_SVG_BYTES)
 * @returns 표준화된 크기 제한 초과 에러
 */
export function createSvgSizeLimitError(
  label: string,
  actualBytes: number,
  maxBytes = MAX_SVG_BYTES
): ImageProcessError {
  return new ImageProcessError(
    `SVG input size (${actualBytes} bytes) exceeds the maximum allowed (${maxBytes} bytes): ${label}`,
    'SVG_BYTES_EXCEEDED',
    { details: { actualBytes, maxBytes, label } }
  );
}

/**
 * SVG 문자열의 크기가 허용 한도를 초과하는지 검사한다.
 *
 * @param svgString 검사할 SVG 문자열
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 * @throws {ImageProcessError} 크기 초과 시
 */
export function checkSvgSizeLimit(svgString: string, label: string): void {
  const actualBytes = getUtf8ByteLength(svgString);
  if (actualBytes > MAX_SVG_BYTES) {
    throw createSvgSizeLimitError(label, actualBytes);
  }
}

/**
 * 응답 헤더에 선언된 SVG 본문 크기가 허용 한도를 넘는지 사전 확인한다.
 *
 * @param response fetch 응답 객체
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 */
function checkSvgContentLengthHeader(response: Response, label: string): void {
  const declaredLength = response.headers.get('content-length');
  if (!declaredLength) {
    return;
  }

  const parsedLength = Number.parseInt(declaredLength, 10);
  if (Number.isFinite(parsedLength) && parsedLength > MAX_SVG_BYTES) {
    throw createSvgSizeLimitError(label, parsedLength);
  }
}

/**
 * 원격 텍스트 응답 본문을 fail-closed 정책으로 읽고 크기를 검증한다.
 *
 * @param response fetch 응답 객체
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 * @returns 검증된 응답 문자열
 */
export async function readCheckedTextResponse(response: Response, label: string): Promise<string> {
  checkSvgContentLengthHeader(response, label);

  if (!response.body) {
    try {
      const responseText = await response.text();
      checkSvgSizeLimit(responseText, label);
      return responseText;
    } catch (error) {
      if (error instanceof ImageProcessError) {
        throw error;
      }

      throw new ImageProcessError(
        `${label} response body could not be safely verified; load is blocked`,
        'INVALID_SOURCE',
        { cause: error, details: { label } }
      );
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const decodedChunk = decoder.decode(value, { stream: true });

      totalBytes += value.byteLength;
      if (totalBytes > MAX_SVG_BYTES) {
        await reader.cancel();
        throw createSvgSizeLimitError(label, totalBytes);
      }

      chunks.push(decodedChunk);
    }

    const tailChunk = decoder.decode();
    chunks.push(tailChunk);
    return chunks.join('');
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError(
      `${label} response body could not be safely verified; load is blocked`,
      'INVALID_SOURCE',
      { cause: error, details: { label } }
    );
  } finally {
    reader.releaseLock();
  }
}

/**
 * 원격 SVG 응답 본문을 fail-closed 정책으로 읽고 검증한다.
 *
 * @param response fetch 응답 객체
 * @param label 에러 메시지에 포함할 입력 출처 레이블
 * @returns 검증된 SVG 문자열
 */
export async function readVerifiedSvgResponse(response: Response, label: string): Promise<string> {
  const responseText = await readCheckedTextResponse(response, label);
  if (!isInlineSvg(responseText)) {
    const contentType = response.headers.get('content-type') ?? null;
    throw new ImageProcessError('Remote response is not a valid SVG', 'INVALID_SOURCE', {
      details: { contentType, label },
    });
  }

  return responseText;
}

/**
 * CSS url() 함수 내부에 외부 URL이나 상대 경로 참조가 있는지 확인한다.
 *
 * @param cssText 검사할 CSS 텍스트
 * @returns 위험한 참조가 있으면 true
 */
function hasDangerousUrlRef(cssText: string): boolean {
  let hasDangerousRef = false;
  visitCssUrlValues(cssText, (value) => {
    if (getCssPolicyValueVariants(value).some(isBlockedSvgPolicyRef)) {
      hasDangerousRef = true;
    }
  });
  return hasDangerousRef;
}

type SvgUnsafeReason = 'script-tag' | 'event-handler' | 'external-ref' | 'style-attribute-url' | 'style-tag-url';

function throwUnsafeSvg(reason: SvgUnsafeReason): never {
  throw new ImageProcessError(`SVG content contains a forbidden construct: ${reason}`, 'INVALID_SOURCE', {
    details: { reason },
  });
}

/**
 * SVG 문자열에 위험한 콘텐츠가 포함되어 있는지 검사한다.
 *
 * 다음 항목이 발견되면 ImageProcessError를 던진다:
 *  - `<script` 태그 (대소문자 무관)
 *  - `onload`, `onclick` 등 `on*` 이벤트 핸들러 속성
 *  - href, xlink:href, src 속성에 외부 URL(http://, https://), 상대 경로(./, ../, /), javascript: URI가 있는 경우
 *  - style 속성이나 `<style>` 태그 내부에 외부 URL 또는 상대 경로를 담은 url() 참조가 있는 경우
 *
 * @param svgString 검사할 SVG 문자열
 * @throws {ImageProcessError} 위험한 콘텐츠 발견 시
 */
export function assertSafeSvgContent(svgString: string): void {
  const lower = svgString.toLowerCase();

  // 1. <script 태그 차단
  if (lower.includes('<script')) {
    throwUnsafeSvg('script-tag');
  }

  // 2. onload / onclick 등 이벤트 핸들러 속성을 차단한다.
  if (/\son[a-z0-9:-]*\s*=/i.test(svgString)) {
    throwUnsafeSvg('event-handler');
  }

  // 3~4. 태그 내부 속성만 대상으로 외부 참조를 검사한다.
  const tagPattern = SVG_START_TAG_PATTERN;
  let tagMatch: RegExpExecArray | null;
  tagMatch = tagPattern.exec(svgString);
  while (tagMatch !== null) {
    const attrs = tagMatch[2];

    const refAttrPattern = /\s+(?:href|xlink:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|(?!["'])([^\s>]+))/gi;
    let refMatch: RegExpExecArray | null;
    refMatch = refAttrPattern.exec(attrs);
    while (refMatch !== null) {
      const refValue = refMatch[1] ?? refMatch[2] ?? refMatch[3];
      if (refValue && isBlockedSvgPolicyRef(refValue)) {
        throwUnsafeSvg('external-ref');
      }
      refMatch = refAttrPattern.exec(attrs);
    }

    const styleDoubleQuote = /\s+style\s*=\s*"((?:[^"\\]|\\.)*)"/gi;
    const styleSingleQuote = /\s+style\s*=\s*'((?:[^'\\]|\\.)*)'/gi;
    const styleUnquoted = /\s+style\s*=\s*(?!["'])([^\s>]+)/gi;
    let styleMatch: RegExpExecArray | null;
    styleMatch = styleDoubleQuote.exec(attrs);
    while (styleMatch !== null) {
      if (hasDangerousUrlRef(styleMatch[1])) {
        throwUnsafeSvg('style-attribute-url');
      }
      styleMatch = styleDoubleQuote.exec(attrs);
    }
    styleMatch = styleSingleQuote.exec(attrs);
    while (styleMatch !== null) {
      if (hasDangerousUrlRef(styleMatch[1])) {
        throwUnsafeSvg('style-attribute-url');
      }
      styleMatch = styleSingleQuote.exec(attrs);
    }
    styleMatch = styleUnquoted.exec(attrs);
    while (styleMatch !== null) {
      if (hasDangerousUrlRef(styleMatch[1])) {
        throwUnsafeSvg('style-attribute-url');
      }
      styleMatch = styleUnquoted.exec(attrs);
    }

    tagMatch = tagPattern.exec(svgString);
  }

  // <style> 태그 내부 콘텐츠의 url() 추출
  const styleTagPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleTagMatch: RegExpExecArray | null;
  styleTagMatch = styleTagPattern.exec(svgString);
  while (styleTagMatch !== null) {
    const styleContent = styleTagMatch[1];
    if (hasDangerousUrlRef(styleContent)) {
      throwUnsafeSvg('style-tag-url');
    }
    styleTagMatch = styleTagPattern.exec(svgString);
  }
}
