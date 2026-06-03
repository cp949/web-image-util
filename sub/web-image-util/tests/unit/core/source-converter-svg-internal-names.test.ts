import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDir, '../../../src/core/source-converter/svg');
const loadersRoot = resolve(currentDir, '../../../src/core/source-converter/loaders');

describe('source-converter SVG 내부 구현 파일명', () => {
  it('공개 진입점이 아닌 SVG 변환 구현 파일은 internal 접미사를 사용한다', () => {
    for (const moduleName of ['data-url', 'loader', 'safety']) {
      expect(existsSync(resolve(sourceRoot, `${moduleName}.internal.ts`))).toBe(true);
      expect(existsSync(resolve(sourceRoot, `${moduleName}.ts`))).toBe(false);
    }
  });

  it('공개 진입점이 아닌 입력 형태별 로더 파일은 internal 접미사를 사용한다', () => {
    for (const moduleName of ['blob', 'canvas', 'string']) {
      expect(existsSync(resolve(loadersRoot, `${moduleName}.internal.ts`))).toBe(true);
      expect(existsSync(resolve(loadersRoot, `${moduleName}.ts`))).toBe(false);
    }
  });
});
