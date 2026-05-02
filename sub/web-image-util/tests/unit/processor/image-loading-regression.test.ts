/**
 * 이미지 로딩 경로 회귀를 막기 위한 안전장치 테스트다.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import { processImage } from '../../../src/processor';
import { isImageElement } from '../../../src/types/guards';
import { createTestImageBlob } from '../../utils/image-helper';

/**
 * 소스 디렉터리의 TypeScript 파일을 재귀적으로 모은다.
 */
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

/**
 * TypeScript AST에서 런타임 import/export 모듈 지정자를 수집한다.
 */
function collectRuntimeImportSpecifiers(sourceText: string): string[] {
  const sourceFile = ts.createSourceFile('source.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const importClause = node.importClause;
      const namedBindings = importClause?.namedBindings;
      const hasOnlyTypeNamedImports =
        namedBindings &&
        ts.isNamedImports(namedBindings) &&
        namedBindings.elements.length > 0 &&
        namedBindings.elements.every((element) => element.isTypeOnly);

      if (!importClause?.isTypeOnly && !(hasOnlyTypeNamedImports && !importClause?.name)) {
        specifiers.push(node.moduleSpecifier.text);
      }
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const exportClause = node.exportClause;
      const hasOnlyTypeNamedExports =
        exportClause &&
        ts.isNamedExports(exportClause) &&
        exportClause.elements.length > 0 &&
        exportClause.elements.every((element) => element.isTypeOnly);

      if (!node.isTypeOnly && !hasOnlyTypeNamedExports) {
        specifiers.push(node.moduleSpecifier.text);
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

/**
 * src 내부 상대 import를 실제 TypeScript 파일 경로로 해석한다.
 */
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

/**
 * 시작 파일에서 정적 import 그래프를 따라 닿을 수 있는 src 파일을 수집한다.
 */
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
    for (const specifier of collectRuntimeImportSpecifiers(content)) {
      const resolved = await resolveSourceImport(current, specifier);
      if (resolved && !visited.has(resolved)) {
        pending.push(resolved);
      }
    }
  }

  return Array.from(visited);
}

describe('image loading regression safeguards', () => {
  it('should create output elements without using the global Image constructor', async () => {
    const input = await createTestImageBlob(64, 64, 'red');
    const originalImage = globalThis.Image;
    let constructorCalls = 0;
    const forbiddenImageConstructor = vi.fn(
      class ForbiddenImage {
        constructor() {
          constructorCalls += 1;
          throw new Error('Unexpected global Image constructor usage');
        }
      }
    );

    // happy-dom에서도 document.createElement('img') 경로만 타는지 확인한다.
    globalThis.Image = forbiddenImageConstructor as unknown as typeof Image;

    try {
      const element = await (processImage(input).resize({ fit: 'cover', width: 32, height: 32 }) as any).toElement();

      expect(element.width).toBeGreaterThan(0);
      expect(constructorCalls).toBe(0);
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('should return an element that is recognized as an HTMLImageElement in the Node test environment', async () => {
    const input = await createTestImageBlob(64, 64, 'red');
    const element = await (processImage(input).resize({ fit: 'cover', width: 32, height: 32 }) as any).toElement();

    expect(element instanceof HTMLImageElement).toBe(true);
    expect(isImageElement(element)).toBe(true);
  });

  it('should accept a toElement() result as an image source for a follow-up processing pass', async () => {
    const input = await createTestImageBlob(64, 64, 'red');
    const element = await (processImage(input).resize({ fit: 'cover', width: 32, height: 32 }) as any).toElement();
    const roundTrip = await (processImage(element).resize({ fit: 'contain', width: 16, height: 16 }) as any).toBlob();

    expect(roundTrip.blob).toBeInstanceOf(Blob);
    expect(roundTrip.blob.size).toBeGreaterThan(0);
    expect(roundTrip.width).toBe(16);
    expect(roundTrip.height).toBe(16);
  });

  it('should keep runtime source files free of new Image() to avoid happy-dom loader leaks', async () => {
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
    const processImagePathFiles = await collectReachableSourceFiles(path.resolve(srcRoot, 'processor.ts'));
    const offenders: string[] = [];

    for (const filePath of processImagePathFiles) {
      const content = await readFile(filePath, 'utf8');
      const specifiers = collectRuntimeImportSpecifiers(content);
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
  });
});
