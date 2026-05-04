/**
 * 원격 응답이 SVG가 아닐 때 일반 이미지 로딩으로 폴백하는 정책을 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToElement } from '../../../src/utils/converters';
import { withFetchMock } from '../../utils';
import { createStreamBody } from '../helpers/svg-test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 원격 SVG fetch 비-SVG 폴백', () => {
  it('fetch 실패한 비-SVG URL(.png)은 직접 로드로 허용된다', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error('cors blocked'));

    await withFetchMock(fetchMock, async () => {
      const element = await convertToElement('https://example.com/image.png');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(element.src).toBe('https://example.com/image.png');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('XML MIME 응답에서 SVG가 아닌 콘텐츠는 일반 이미지로 폴백한다', async () => {
    const textSpy = vi.fn().mockResolvedValue('unused fallback');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'text/xml' : null;
        },
      },
      body: createStreamBody(['<root><item>not an svg</item></root>']),
      text: textSpy,
    });

    await withFetchMock(fetchMock, async () => {
      // text/xml 응답이지만 SVG가 아닌 경우 HTMLImageElement로 폴백한다 (정책 명시)
      const element = await convertToElement('https://example.com/data.xml');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(textSpy).not.toHaveBeenCalled();
    });
  });

  it('단일 소비 스트림인 XML MIME 응답도 SVG가 아니면 일반 이미지 로딩으로 폴백한다', async () => {
    let bodyConsumed = false;
    let readerRequests = 0;
    const textSpy = vi.fn().mockResolvedValue('unused fallback');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'text/xml' : null;
        },
      },
      body: {
        getReader() {
          readerRequests += 1;
          if (bodyConsumed) {
            throw new Error('body stream already consumed');
          }

          bodyConsumed = true;
          let done = false;

          return {
            async read() {
              if (done) {
                return { done: true, value: undefined };
              }

              done = true;
              return {
                done: false,
                value: new TextEncoder().encode('<root><item>not an svg</item></root>'),
              };
            },
            async cancel() {},
            releaseLock() {},
          };
        },
      },
      text: textSpy,
    });

    await withFetchMock(fetchMock, async () => {
      const element = await convertToElement('https://example.com/single-use-data.xml');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(textSpy).not.toHaveBeenCalled();
      expect(readerRequests).toBe(1);
    });
  });
});
