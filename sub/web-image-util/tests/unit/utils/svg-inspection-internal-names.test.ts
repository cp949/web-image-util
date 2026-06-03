import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const inspectionRoot = resolve(currentDir, '../../../src/utils/svg-inspection');

describe('svg-inspection 내부 구현 파일명', () => {
  it('inspectSvg 전용 오케스트레이션 헬퍼 파일은 internal 접미사를 사용한다', () => {
    for (const moduleName of [
      'css-signals',
      'dom-analysis',
      'dom-signals',
      'environment',
      'fallback-analysis',
      'parser',
      'reference-attribute',
      'report',
      'sample-utils',
    ]) {
      expect(existsSync(resolve(inspectionRoot, `${moduleName}.internal.ts`))).toBe(true);
      expect(existsSync(resolve(inspectionRoot, `${moduleName}.ts`))).toBe(false);
    }
  });
});
