import { describe, expect, test } from 'vitest';

// 런타임 감사 스크립트를 직접 검증하기 위해 선언 파일 없이 .mjs 모듈을 불러온다.
// @ts-expect-error 테스트에서 런타임 스크립트를 직접 import한다.
import {
  filterAllowedViolations,
  findAllowedViolations,
  findViolationsInSource,
} from '../../../scripts/browser-compat-checker.mjs';

describe('브라우저 호환성 정적 감사', () => {
  test('금지 API가 없으면 위반이 없다', () => {
    const source = 'export function add(a: number, b: number) {\n  return a + b;\n}\n';
    expect(findViolationsInSource(source, 'src/example.ts')).toEqual([]);
  });

  test('AbortSignal.timeout 사용처를 파일과 줄 번호로 찾아낸다', () => {
    const source = 'const controller = new AbortController();\nAbortSignal.timeout(1000);\n';
    const violations = findViolationsInSource(source, 'src/example.ts');
    expect(violations).toEqual([{ file: 'src/example.ts', line: 2, api: 'AbortSignal.timeout', minChrome: 103 }]);
  });

  test('한 줄에 여러 금지 API가 있으면 모두 찾아낸다', () => {
    const source = 'structuredClone(value); a.replaceAll("x", "y");\n';
    const violations = findViolationsInSource(source, 'src/example.ts');
    expect(violations).toEqual([
      { file: 'src/example.ts', line: 1, api: 'structuredClone', minChrome: 98 },
      { file: 'src/example.ts', line: 1, api: 'String.prototype.replaceAll', minChrome: 85 },
    ]);
  });

  test('allowlist에 등록된 (file, api) 쌍은 위반에서 제외된다', () => {
    const violations = [{ file: 'src/example.ts', line: 2, api: 'AbortSignal.timeout', minChrome: 103 }];
    const allowlist = [{ file: 'src/example.ts', api: 'AbortSignal.timeout', reason: 'typeof 가드 존재' }];
    expect(filterAllowedViolations(violations, allowlist)).toEqual([]);
  });

  test('allowlist에 없는 위반은 그대로 남는다', () => {
    const violations = [{ file: 'src/other.ts', line: 5, api: 'structuredClone', minChrome: 98 }];
    const allowlist = [{ file: 'src/example.ts', api: 'AbortSignal.timeout', reason: 'typeof 가드 존재' }];
    expect(filterAllowedViolations(violations, allowlist)).toEqual(violations);
  });

  test('findAllowedViolations는 여러 파일을 모아 allowlist로 거른다', () => {
    const sources = [
      { filePath: 'src/a.ts', sourceText: 'AbortSignal.timeout(1);\n' },
      { filePath: 'src/b.ts', sourceText: 'structuredClone(1);\n' },
    ];
    const allowlist = [{ file: 'src/a.ts', api: 'AbortSignal.timeout', reason: '가드 존재' }];
    expect(findAllowedViolations(sources, allowlist)).toEqual([
      { file: 'src/b.ts', line: 1, api: 'structuredClone', minChrome: 98 },
    ]);
  });
});
