/**
 * Chrome 75 이후 추가된 런타임 API 목록이다. 각 항목은 소스에서 찾을 정규식과
 * 사람이 읽을 API 이름, 참고용 최소 지원 Chrome 버전을 갖는다. best-effort
 * 목록이며 MDN 기준 근사치다 — 신규 위험 API가 발견되면 이 배열에 추가한다.
 */
export const BROWSER_COMPAT_DENYLIST = [
  { api: 'AbortSignal.timeout', pattern: /AbortSignal\.timeout\b/, minChrome: 103 },
  { api: 'AbortSignal.any', pattern: /AbortSignal\.any\b/, minChrome: 116 },
  { api: 'structuredClone', pattern: /\bstructuredClone\b/, minChrome: 98 },
  { api: 'String.prototype.replaceAll', pattern: /\.replaceAll\(/, minChrome: 85 },
  { api: 'Promise.allSettled', pattern: /\bPromise\.allSettled\b/, minChrome: 76 },
  { api: 'Object.hasOwn', pattern: /\bObject\.hasOwn\b/, minChrome: 93 },
  { api: 'Array/String.prototype.at', pattern: /\.at\(/, minChrome: 92 },
  { api: 'WeakRef', pattern: /\bnew WeakRef\b/, minChrome: 84 },
  { api: 'FinalizationRegistry', pattern: /\bnew FinalizationRegistry\b/, minChrome: 84 },
  { api: 'Array.prototype.toSorted', pattern: /\.toSorted\(/, minChrome: 110 },
  { api: 'Array.prototype.toReversed', pattern: /\.toReversed\(/, minChrome: 110 },
  { api: 'Array.prototype.toSpliced', pattern: /\.toSpliced\(/, minChrome: 110 },
  { api: 'Array.prototype.with', pattern: /\.with\(/, minChrome: 110 },
  { api: 'Array.fromAsync', pattern: /Array\.fromAsync\b/, minChrome: 121 },
  { api: 'Object.groupBy', pattern: /Object\.groupBy\b/, minChrome: 117 },
  { api: 'Map.groupBy', pattern: /Map\.groupBy\b/, minChrome: 117 },
  { api: 'crypto.randomUUID', pattern: /crypto\.randomUUID\b/, minChrome: 92 },
];

/**
 * 소스 텍스트 하나에서 감시 대상 API 사용처를 찾는다. 줄 번호는 1부터 시작한다.
 */
export function findViolationsInSource(sourceText, filePath) {
  const violations = [];
  const lines = sourceText.split('\n');

  lines.forEach((line, index) => {
    for (const entry of BROWSER_COMPAT_DENYLIST) {
      if (entry.pattern.test(line)) {
        violations.push({ file: filePath, line: index + 1, api: entry.api, minChrome: entry.minChrome });
      }
    }
  });

  return violations;
}

/**
 * allowlist에 (file, api) 쌍이 등록되어 있으면 위반 목록에서 제외한다.
 */
export function filterAllowedViolations(violations, allowlist) {
  const allowedKeys = new Set(allowlist.map((entry) => `${entry.file}::${entry.api}`));
  return violations.filter((violation) => !allowedKeys.has(`${violation.file}::${violation.api}`));
}

/**
 * 여러 파일의 소스 텍스트에서 위반을 모으고 allowlist로 걸러낸다.
 * `sources`는 { filePath, sourceText } 배열이다.
 */
export function findAllowedViolations(sources, allowlist) {
  const allViolations = sources.flatMap(({ filePath, sourceText }) => findViolationsInSource(sourceText, filePath));
  return filterAllowedViolations(allViolations, allowlist);
}
