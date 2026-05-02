/**
 * 배포 매니페스트 계약 테스트
 *
 * @description
 * `npm pack`이 사용할 `package.json` 메타데이터(공개성, files, exports, 진입점)가
 * 의도된 모양에서 벗어나지 않는지 확인한다. 실제 `npm pack`은 dist 빌드를
 * 요구하므로, 여기서는 매니페스트 계약만 검증한다.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '../../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;

const exports = pkg.exports as Record<string, { import?: string; types?: string }>;

describe('package.json 배포 매니페스트', () => {
  test('공개 패키지 식별 정보가 유지된다', () => {
    expect(pkg.name).toBe('@cp949/web-image-util');
    expect(pkg.private).not.toBe(true);
    expect(pkg.type).toBe('module');
    expect(typeof pkg.version).toBe('string');
    expect(pkg.license).toBe('MIT');
  });

  test('진입점(main/module/types)이 dist 산출물을 가리킨다', () => {
    expect(pkg.main).toBe('./dist/index.js');
    expect(pkg.module).toBe('./dist/index.js');
    expect(pkg.types).toBe('./dist/index.d.ts');
  });

  test('files 목록은 dist + 사용자 문서만 포함한다', () => {
    expect(pkg.files).toEqual(['dist', 'README.md', 'llm.txt']);
  });

  test('exports 맵은 문서화된 서브패스를 모두 노출한다', () => {
    expect(Object.keys(exports).sort()).toEqual([
      '.',
      './advanced',
      './filters',
      './presets',
      './svg-sanitizer',
      './utils',
    ]);
  });

  test('모든 exports 항목은 ESM import 경로와 타입 정의 경로를 포함한다', () => {
    for (const [subpath, entry] of Object.entries(exports)) {
      expect(entry, `exports[${subpath}]`).toMatchObject({
        import: expect.stringMatching(/^\.\/dist\/.+\.js$/),
        types: expect.stringMatching(/^\.\/dist\/.+\.d\.ts$/),
      });
    }
  });

  test('루트 export와 서브패스 export 경로가 짝을 이룬다', () => {
    const expectedSubpathTargets: Record<string, { import: string; types: string }> = {
      '.': { import: './dist/index.js', types: './dist/index.d.ts' },
      './advanced': {
        import: './dist/advanced-index.js',
        types: './dist/advanced-index.d.ts',
      },
      './presets': {
        import: './dist/presets/index.js',
        types: './dist/presets/index.d.ts',
      },
      './utils': {
        import: './dist/utils/index.js',
        types: './dist/utils/index.d.ts',
      },
      './filters': {
        import: './dist/filters/plugins/index.js',
        types: './dist/filters/plugins/index.d.ts',
      },
      './svg-sanitizer': {
        import: './dist/svg-sanitizer/index.js',
        types: './dist/svg-sanitizer/index.d.ts',
      },
    };

    for (const [subpath, expected] of Object.entries(expectedSubpathTargets)) {
      expect(exports[subpath]).toEqual(expected);
    }
  });

  test('repository / homepage 같은 npm 레지스트리 메타데이터가 존재한다', () => {
    expect(pkg.repository).toBeDefined();
    expect(pkg.homepage).toBeDefined();
    expect(pkg.author).toBeDefined();
  });
});
