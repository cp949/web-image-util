/**
 * 경량(lightweight)·strict sanitizer 동치성 코퍼스.
 *
 * 규율: 두 sanitizer의 모든 동작 차이는 이 코퍼스에 기대값으로 등재되어 있어야 한다.
 * 차이가 있는 항목은 `divergence`에 이유를 명시한다 — divergence가 없는 항목은
 * 두 모드가 같은 위협을 같은 방식으로 제거한다는 동치성 계약이다.
 *
 * 기대값은 실측 기준이다. 위협 정책이 바뀌면 이 코퍼스의 기대값을 의도적으로 함께
 * 갱신한다(코퍼스 갱신 없는 동작 변화는 회귀다).
 */

export interface SanitizerExpectation {
  /** 정제 결과에 남아 있어야 하는 부분 문자열 */
  preserves?: string[];
  /** 정제 결과에 없어야 하는 부분 문자열 */
  removes?: string[];
}

export interface SanitizerEquivalenceCase {
  name: string;
  svg: string;
  expected: {
    lightweight: SanitizerExpectation;
    strict: SanitizerExpectation;
  };
  /** 두 모드의 기대가 의도적으로 다른 경우 그 이유 */
  divergence?: string;
}

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg">';

/** `<image href="...">` 형태의 URI 케이스를 만든다 */
function imageHref(href: string): string {
  return `${SVG_OPEN}<image href="${href}"/></svg>`;
}

/** `<rect style="...">` 형태의 CSS 케이스를 만든다 */
function rectStyle(style: string): string {
  return `${SVG_OPEN}<rect style="${style}"/></svg>`;
}

export const SANITIZER_EQUIVALENCE_CORPUS: SanitizerEquivalenceCase[] = [
  // ─── URI: 두 모드 동치 ───
  {
    name: 'URI: 내부 fragment는 양쪽 모두 보존한다',
    svg: imageHref('#frag'),
    expected: {
      lightweight: { preserves: ['#frag'] },
      strict: { preserves: ['#frag'] },
    },
  },
  {
    name: 'URI: http 절대 URL은 양쪽 모두 제거한다',
    svg: imageHref('http://evil.example.com/a.png'),
    expected: {
      lightweight: { removes: ['evil.example.com'] },
      strict: { removes: ['evil.example.com'] },
    },
  },
  {
    name: 'URI: https 절대 URL은 양쪽 모두 제거한다',
    svg: imageHref('https://evil.example.com/a.png'),
    expected: {
      lightweight: { removes: ['evil.example.com'] },
      strict: { removes: ['evil.example.com'] },
    },
  },
  {
    name: 'URI: protocol-relative URL은 양쪽 모두 제거한다',
    svg: imageHref('//evil.example.com/a.png'),
    expected: {
      lightweight: { removes: ['evil.example.com'] },
      strict: { removes: ['evil.example.com'] },
    },
  },
  {
    name: 'URI: 안전한 raster data URL은 양쪽 모두 원본 보존한다',
    svg: imageHref('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='),
    expected: {
      lightweight: { preserves: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='] },
      strict: { preserves: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='] },
    },
  },
  {
    name: 'URI: nested SVG data URL은 양쪽 모두 재귀 정제 후 base64 재인코딩한다',
    svg: imageHref('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E'),
    expected: {
      lightweight: { preserves: ['data:image/svg+xml;base64,'] },
      strict: { preserves: ['data:image/svg+xml;base64,'] },
    },
  },
  {
    name: 'URI: 대소문자 변형 javascript 스킴은 양쪽 모두 제거한다',
    svg: imageHref('JaVaScRiPt:alert(1)'),
    expected: {
      lightweight: { removes: ['alert(1)'] },
      strict: { removes: ['alert(1)'] },
    },
  },

  // ─── URI: 정책 통일 후 동치 (상대 경로·미지 스킴·빈 값 폐쇄) ───
  {
    name: 'URI: ./ 상대 경로는 양쪽 모두 제거한다',
    svg: imageHref('./a.png'),
    expected: {
      lightweight: { removes: ['a.png'] },
      strict: { removes: ['a.png'] },
    },
  },
  {
    name: 'URI: bare 상대 경로는 양쪽 모두 제거한다',
    svg: imageHref('a.png'),
    expected: {
      lightweight: { removes: ['a.png'] },
      strict: { removes: ['a.png'] },
    },
  },
  {
    name: 'URI: / 절대 경로는 양쪽 모두 제거한다',
    svg: imageHref('/a.png'),
    expected: {
      lightweight: { removes: ['a.png'] },
      strict: { removes: ['a.png'] },
    },
  },
  {
    name: 'URI: vbscript 스킴은 양쪽 모두 제거한다',
    svg: imageHref('vbscript:alert(1)'),
    expected: {
      lightweight: { removes: ['vbscript'] },
      strict: { removes: ['vbscript'] },
    },
  },
  {
    name: 'URI: file 스킴은 양쪽 모두 제거한다',
    svg: imageHref('file:///etc/passwd'),
    expected: {
      lightweight: { removes: ['file://'] },
      strict: { removes: ['file://'] },
    },
  },
  {
    name: 'URI: ftp 스킴은 양쪽 모두 제거한다',
    svg: imageHref('ftp://evil.example.com/a.png'),
    expected: {
      lightweight: { removes: ['evil.example.com'] },
      strict: { removes: ['evil.example.com'] },
    },
  },
  {
    name: 'URI: blob 스킴은 양쪽 모두 제거한다',
    svg: imageHref('blob:https://example.com/uuid'),
    expected: {
      lightweight: { removes: ['blob:'] },
      strict: { removes: ['blob:'] },
    },
  },
  {
    name: 'URI: 빈 href는 양쪽 모두 속성을 제거한다',
    svg: imageHref(''),
    expected: {
      lightweight: { removes: ['href'] },
      strict: { removes: ['href'] },
    },
  },

  // ─── CSS: 두 모드 동치 ───
  {
    name: 'CSS: 내부 fragment url()은 양쪽 모두 보존한다',
    svg: rectStyle('fill:url(#g)'),
    expected: {
      lightweight: { preserves: ['url(#g)'] },
      strict: { preserves: ['url(#g)'] },
    },
  },
  {
    name: 'CSS: style 속성의 외부 http url()은 양쪽 모두 none으로 무해화한다',
    svg: rectStyle('fill:url(http://evil.example.com/a.png)'),
    expected: {
      lightweight: { removes: ['evil.example.com'], preserves: ['fill:none'] },
      strict: { removes: ['evil.example.com'], preserves: ['fill:none'] },
    },
  },

  // ─── CSS: 정책 통일 후 동치 (presentation 속성·위험 구문 폐쇄) ───
  {
    name: 'CSS: 상대 경로 url()은 양쪽 모두 무해화한다',
    svg: rectStyle('fill:url(a.png)'),
    expected: {
      lightweight: { removes: ['a.png'] },
      strict: { removes: ['a.png'] },
    },
  },
  {
    name: 'CSS: vbscript url()은 양쪽 모두 무해화한다',
    svg: rectStyle('fill:url(vbscript:x)'),
    expected: {
      lightweight: { removes: ['vbscript'] },
      strict: { removes: ['vbscript'] },
    },
  },
  {
    name: 'CSS: url() 없는 @import는 양쪽 모두 폐기한다',
    svg: rectStyle("@import 'https://evil.example.com/a.css';"),
    expected: {
      lightweight: { removes: ['@import', 'evil.example.com'] },
      strict: { removes: ['@import', 'evil.example.com'] },
    },
  },
  {
    name: 'CSS: expression()은 양쪽 모두 폐기한다',
    svg: rectStyle('width:expression(alert(1))'),
    expected: {
      lightweight: { removes: ['expression('] },
      strict: { removes: ['expression('] },
    },
  },
  {
    name: 'CSS: presentation 속성의 외부 url()은 양쪽 모두 무해화한다',
    svg: `${SVG_OPEN}<rect fill="url(http://evil.example.com/a.png)"/></svg>`,
    expected: {
      lightweight: { removes: ['evil.example.com'] },
      strict: { removes: ['evil.example.com'] },
    },
  },

  // ─── 요소/속성: 두 모드 동치 ───
  {
    name: '요소: script 블록은 양쪽 모두 제거한다',
    svg: `${SVG_OPEN}<script>alert(1)</script></svg>`,
    expected: {
      lightweight: { removes: ['<script', 'alert(1)'] },
      strict: { removes: ['<script', 'alert(1)'] },
    },
  },
  {
    name: '요소: foreignObject는 양쪽 모두 제거한다',
    svg: `${SVG_OPEN}<foreignObject><div>x</div></foreignObject></svg>`,
    expected: {
      lightweight: { removes: ['foreignObject', '<div'] },
      strict: { removes: ['foreignObject', '<div'] },
    },
  },
  {
    name: '속성: on* 이벤트 핸들러는 양쪽 모두 제거한다',
    svg: `${SVG_OPEN}<rect onclick="alert(1)"/></svg>`,
    expected: {
      lightweight: { removes: ['onclick'] },
      strict: { removes: ['onclick'] },
    },
  },

  // ─── 요소/속성: 의도적 모드 차이 (현행 실측) ───
  {
    name: '요소: use — 경량 보존, strict 제거',
    svg: `${SVG_OPEN}<use href="#icon"/></svg>`,
    expected: {
      lightweight: { preserves: ['<use'] },
      strict: { removes: ['<use'] },
    },
    divergence: '경량은 렌더링 경로라 sprite/defs 패턴(use)을 보존한다. href 정책이 외부 참조를 방어한다.',
  },
  {
    name: '요소: href를 타겟팅하는 animate — 경량 통과, strict 제거',
    svg: `${SVG_OPEN}<a href="#x"><animate attributeName="href" to="javascript:alert(1)"/></a></svg>`,
    expected: {
      lightweight: { preserves: ['<animate', 'javascript:alert(1)'] },
      strict: { removes: ['<animate', 'alert(1)'] },
    },
    divergence: '경량은 animate/set 요소를 다루지 않는다 — 알려진 구멍(href 애니메이션 우회).',
  },
  {
    name: '선언: DOCTYPE/ENTITY — 경량 통과, strict 제거',
    svg: `<!DOCTYPE svg [<!ENTITY xxe "boom">]>${SVG_OPEN}<text>x</text></svg>`,
    expected: {
      lightweight: { preserves: ['<!DOCTYPE', '<!ENTITY'] },
      strict: { removes: ['<!DOCTYPE', '<!ENTITY'] },
    },
    divergence: '경량은 XML 선언부를 전처리하지 않는다 — 알려진 구멍(XXE 표면).',
  },
  {
    name: '요소: 닫는 태그 없는 script — 경량 잔존, strict 제거',
    svg: `${SVG_OPEN}<script>alert(1)</svg>`,
    expected: {
      lightweight: { preserves: ['alert(1)'] },
      strict: { removes: ['alert(1)'] },
    },
    divergence:
      '경량 정규식은 닫는 태그가 필요하다. 파이프라인에서는 후치 intake guard가 script-tag THROW로 fail-closed.',
  },
];
