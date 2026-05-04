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
 * @returns 표준화된 크기 제한 초과 에러
 */
export function createSvgSizeLimitError(label: string): ImageProcessError {
  return new ImageProcessError(
    `SVG 입력이 최대 허용 크기(${MAX_SVG_BYTES / 1024 / 1024}MiB)를 초과합니다: ${label}`,
    'INVALID_SOURCE'
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
  if (getUtf8ByteLength(svgString) > MAX_SVG_BYTES) {
    throw createSvgSizeLimitError(label);
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
    throw createSvgSizeLimitError(label);
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
        `${label} 본문을 안전하게 확인할 수 없어 로드를 차단합니다`,
        'INVALID_SOURCE',
        { cause: error }
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
        throw createSvgSizeLimitError(label);
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
      `${label} 본문을 안전하게 확인할 수 없어 로드를 차단합니다`,
      'INVALID_SOURCE',
      { cause: error }
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
    throw new ImageProcessError('원격 응답이 유효한 SVG가 아닙니다', 'INVALID_SOURCE');
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
    throw new ImageProcessError('SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: <script> 태그', 'INVALID_SOURCE');
  }

  // 2. onload / onclick 등 이벤트 핸들러 속성을 차단한다.
  if (/\son[a-z0-9:-]*\s*=/i.test(svgString)) {
    throw new ImageProcessError('SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: 이벤트 핸들러 속성', 'INVALID_SOURCE');
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
        throw new ImageProcessError('SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: 외부 리소스 참조', 'INVALID_SOURCE');
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
        throw new ImageProcessError(
          'SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: style 속성의 외부 url() 참조',
          'INVALID_SOURCE'
        );
      }
      styleMatch = styleDoubleQuote.exec(attrs);
    }
    styleMatch = styleSingleQuote.exec(attrs);
    while (styleMatch !== null) {
      if (hasDangerousUrlRef(styleMatch[1])) {
        throw new ImageProcessError(
          'SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: style 속성의 외부 url() 참조',
          'INVALID_SOURCE'
        );
      }
      styleMatch = styleSingleQuote.exec(attrs);
    }
    styleMatch = styleUnquoted.exec(attrs);
    while (styleMatch !== null) {
      if (hasDangerousUrlRef(styleMatch[1])) {
        throw new ImageProcessError(
          'SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: style 속성의 외부 url() 참조',
          'INVALID_SOURCE'
        );
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
      throw new ImageProcessError(
        'SVG 콘텐츠에 위험한 요소가 포함되어 있습니다: <style> 태그의 외부 url() 참조',
        'INVALID_SOURCE'
      );
    }
    styleTagMatch = styleTagPattern.exec(svgString);
  }
}
