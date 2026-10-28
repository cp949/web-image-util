/**
 * 이미지 로딩 경로 회귀 안전장치 중 jsdom에서 안전한 케이스를 모은다.
 *
 * 분리 기준:
 * - 파일 시스템 정적 분석 케이스(소스에 `new Image()` / strict sanitizer 정적 import 금지)는
 *   DOM 의존성이 없어 jsdom에서 그대로 통과한다.
 *
 * toElement 흐름 케이스는 production이 내부에서 Blob → createObjectURL → Image.src 경로를 거쳐
 * jsdom + canvas 패키지에서 IMAGE_LOAD_FAILED로 거부되는 실제 Blob URL 이미지 로딩은 browser 테스트에서 다룬다.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseSync, Visitor } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectSourceFiles(fullPath);
      }

      if (entry.isFile() && fullPath.endsWith('.ts')) {
        return [fullPath];
      }

      return [];
    })
  );

  return files.flat();
}

const forbiddenImageConstructorPattern = /new\s+(?:globalThis\.)?Image\s*\(/;
const strictSanitizerSourceRoot = path.resolve(import.meta.dirname, '../../../src/svg-sanitizer');

interface DynamicImportSpecifier {
  specifier: string;
  enclosingFunctionName: string | null;
}

function parseSource(sourceText: string) {
  return parseSync('source.ts', sourceText, { lang: 'ts' });
}

function collectStaticImportSpecifiers(sourceText: string): string[] {
  const { module } = parseSource(sourceText);
  const specifiers: string[] = [];

  for (const staticImport of module.staticImports) {
    // `import './side'`는 entries가 비어 있어도 런타임 import다. 모든 항목이 타입 전용일 때만 제외한다.
    const isTypeOnly = staticImport.entries.length > 0 && staticImport.entries.every((entry) => entry.isType);
    if (!isTypeOnly) {
      specifiers.push(staticImport.moduleRequest.value);
    }
  }

  for (const staticExport of module.staticExports) {
    for (const entry of staticExport.entries) {
      if (entry.moduleRequest && !entry.isType) {
        specifiers.push(entry.moduleRequest.value);
        break;
      }
    }
  }

  return specifiers;
}

function collectDynamicImportSpecifiers(sourceText: string): string[] {
  return collectDynamicImportDetails(sourceText).map((detail) => detail.specifier);
}

function collectDynamicImportDetails(sourceText: string): DynamicImportSpecifier[] {
  const { program } = parseSource(sourceText);
  const specifiers: DynamicImportSpecifier[] = [];
  const functionNameStack: (string | null)[] = [];

  function keyName(key: { type: string; name?: string; value?: unknown }): string | null {
    if (key.type === 'Identifier') return key.name ?? null;
    if (key.type === 'Literal' && (typeof key.value === 'string' || typeof key.value === 'number')) {
      return String(key.value);
    }
    return null;
  }

  // 부모(VariableDeclarator, Property, MethodDefinition)가 먼저 방문되므로 자식 함수 노드의 이름을 미리 기록해 둔다.
  const assignedNames = new Map<object, string | null>();

  function enterFunction(node: any): void {
    functionNameStack.push(
      node.type === 'FunctionDeclaration' ? (node.id?.name ?? null) : (assignedNames.get(node) ?? null)
    );
  }

  function leaveFunction(): void {
    functionNameStack.pop();
  }

  new Visitor({
    VariableDeclarator(node: any) {
      if (node.init && node.id.type === 'Identifier') {
        assignedNames.set(node.init, node.id.name);
      }
    },
    Property(node: any) {
      assignedNames.set(node.value, node.computed ? null : keyName(node.key));
    },
    MethodDefinition(node: any) {
      assignedNames.set(node.value, node.computed ? null : keyName(node.key));
    },
    FunctionDeclaration: enterFunction,
    'FunctionDeclaration:exit': leaveFunction,
    FunctionExpression: enterFunction,
    'FunctionExpression:exit': leaveFunction,
    ArrowFunctionExpression: enterFunction,
    'ArrowFunctionExpression:exit': leaveFunction,
    ImportExpression(node: any) {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string' && !node.options) {
        specifiers.push({
          specifier: node.source.value,
          enclosingFunctionName: functionNameStack[functionNameStack.length - 1] ?? null,
        });
      }
    },
  }).visit(program);

  return specifiers;
}

async function resolveSourceImport(fromFile: string, specifier: string): Promise<string | null> {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [basePath, `${basePath}.ts`, path.join(basePath, 'index.ts')];

  for (const candidate of candidates) {
    try {
      const stats = await stat(candidate);
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // 다음 후보를 확인한다.
    }
  }

  return null;
}

async function collectReachableSourceFiles(entryFile: string): Promise<string[]> {
  const visited = new Set<string>();
  const pending = [entryFile];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    const content = await readFile(current, 'utf8');
    for (const specifier of collectStaticImportSpecifiers(content)) {
      const resolved = await resolveSourceImport(current, specifier);
      if (resolved && !visited.has(resolved)) {
        pending.push(resolved);
      }
    }
  }

  return Array.from(visited);
}

describe('image loading regression safeguards (정적 분석, jsdom-safe)', () => {
  it('should keep runtime source files free of new Image() to avoid loader leaks', async () => {
    const srcRoot = path.resolve(import.meta.dirname, '../../../src');
    const sourceFiles = await collectSourceFiles(srcRoot);
    const offenders: string[] = [];

    for (const filePath of sourceFiles) {
      const content = await readFile(filePath, 'utf8');

      if (forbiddenImageConstructorPattern.test(content)) {
        offenders.push(path.relative(srcRoot, filePath));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('processImage 경로는 strict SVG sanitizer를 자동 연결하지 않는다', async () => {
    const srcRoot = path.resolve(import.meta.dirname, '../../../src');
    const svgLoaderPath = path.resolve(srcRoot, 'core/source-converter/svg/loader.internal.ts');
    const processImagePathFiles = await collectReachableSourceFiles(path.resolve(srcRoot, 'processor.ts'));
    const offenders: string[] = [];

    for (const filePath of processImagePathFiles) {
      const content = await readFile(filePath, 'utf8');
      const specifiers = collectStaticImportSpecifiers(content);
      const importsForbiddenModule = specifiers.some((specifier) => {
        if (specifier === 'dompurify' || specifier === '@cp949/web-image-util/svg-sanitizer') {
          return true;
        }

        const resolved = path.resolve(path.dirname(filePath), specifier);
        return specifier.startsWith('.') && resolved.startsWith(strictSanitizerSourceRoot);
      });

      if (filePath.startsWith(strictSanitizerSourceRoot) || importsForbiddenModule) {
        offenders.push(path.relative(srcRoot, filePath));
      }
    }

    expect(offenders).toEqual([]);

    const svgLoaderContent = await readFile(svgLoaderPath, 'utf8');
    const dynamicImports = collectDynamicImportDetails(svgLoaderContent).filter((detail) => {
      const resolved = path.resolve(path.dirname(svgLoaderPath), detail.specifier);
      return detail.specifier.startsWith('.') && resolved.startsWith(strictSanitizerSourceRoot);
    });
    expect(dynamicImports).toHaveLength(1);
    expect(dynamicImports[0]).toEqual({
      specifier: '../../../svg-sanitizer',
      enclosingFunctionName: 'sanitizeSvgStrictForProcessing',
    });

    expect(collectDynamicImportSpecifiers(svgLoaderContent)).toContain('../../../svg-sanitizer');
  });
});
