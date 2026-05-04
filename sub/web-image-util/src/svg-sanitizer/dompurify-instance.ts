/**
 * DOMPurify 인스턴스 게이트웨이.
 *
 * 브라우저/번들러 환경마다 DOMPurify가 이미 `sanitize()`를 가진 인스턴스로
 * 들어오기도 하고, factory 함수로 들어오기도 하므로 그 차이를 흡수한다.
 * 모듈 변수에 단일 인스턴스를 캐시해 첫 호출 이후 재사용한다.
 */

import DOMPurify from 'dompurify';

type DOMPurifyInstance = ReturnType<typeof DOMPurify>;

/** DOMPurify 인스턴스 캐시 */
let domPurifyInstance: DOMPurifyInstance | null = null;

/**
 * 실행 환경에 맞는 DOMPurify 인스턴스를 반환한다.
 *
 * DOMPurify는 번들/런타임 형태에 따라 이미 `sanitize()`를 가진 인스턴스로
 * 들어오기도 하고, `window`를 받아 인스턴스를 만드는 factory로 들어오기도 한다.
 * 이 라이브러리는 브라우저용 패키지이므로 factory 형태에서는 현재 window를 주입한다.
 *
 * @returns DOMPurify sanitizer 인스턴스
 */
export function getDomPurify(): DOMPurifyInstance {
  if (domPurifyInstance) {
    return domPurifyInstance;
  }

  if (typeof globalThis.window === 'undefined') {
    if (typeof DOMPurify.sanitize === 'function') {
      return DOMPurify;
    }

    throw new Error('sanitizeSvgStrict: DOMPurify를 초기화하려면 window 객체가 필요합니다.');
  }

  domPurifyInstance = DOMPurify(globalThis.window);
  return domPurifyInstance;
}
