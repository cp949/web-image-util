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

interface DynamicImportSpecifier {
  specifier: string;
  enclosingFunctionName: string | null;
}

/**
 * TypeScript AST에서 정적 import/export 모듈 지정자만 수집한다.
 * 동적 import() 표현은 포함하지 않는다.
 */
function collectStaticImportSpecifiers(sourceText: string): string[] {
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

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

/**
 * TypeScript AST에서 동적 import() 호출의 모듈 지정자만 수집한다.
 */
function collectDynamicImportSpecifiers(sourceText: string): string[] {
  return collectDynamicImportDetails(sourceText).map((detail) => detail.specifier);
}

/**
 * TypeScript AST에서 동적 import() 호출과 이를 감싸는 함수명을 함께 수집한다.
 */
function collectDynamicImportDetails(sourceText: string): DynamicImportSpecifier[] {
  const sourceFile = ts.createSourceFile('source.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: DynamicImportSpecifier[] = [];
  const functionNameStack: (string | null)[] = [];

  function visit(node: ts.Node): void {
    const functionName = getFunctionName(node);
    if (functionName !== undefined) {
      functionNameStack.push(functionName);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push({
        specifier: node.arguments[0].text,
        enclosingFunctionName: functionNameStack[functionNameStack.length - 1] ?? null,
      });
    }

    ts.forEachChild(node, visit);

    if (functionName !== undefined) {
      functionNameStack.pop();
    }
  }

  function getFunctionName(node: ts.Node): string | null | undefined {
    if (ts.isFunctionDeclaration(node)) {
      return node.name?.text ?? null;
    }

    if (ts.isMethodDeclaration(node)) {
      return ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)
        ? node.name.text
        : null;
    }

    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (ts.isPropertyAssignment(parent)) {
        const name = parent.name;
        return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : null;
      }
      return null;
    }

    return undefined;
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
 * 시작 파일에서 정적 import 그래프만 따라 닿을 수 있는 src 파일을 수집한다.
 * 동적 import()는 그래프 탐색에서 제외한다.
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
    // 정적 import만 그래프 탐색에 사용한다. 동적 import는 런타임 opt-in이므로 제외한다.
    for (const specifier of collectStaticImportSpecifiers(content)) {
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
    const sourceConverterPath = path.resolve(srcRoot, 'core/source-converter.ts');
    const processImagePathFiles = await collectReachableSourceFiles(path.resolve(srcRoot, 'processor.ts'));
    const offenders: string[] = [];

    for (const filePath of processImagePathFiles) {
      const content = await readFile(filePath, 'utf8');
      // 정적 import만 검사한다. 동적 import는 opt-in 로딩이므로 허용한다.
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

    // source-converter.ts는 strict sanitizer를 동적 import로만 로드해야 한다.
    // sanitizeSvgStrictForProcessing 함수 안에 정확히 하나의 동적 import가 있어야 한다.
    const sourceConverterContent = await readFile(sourceConverterPath, 'utf8');
    const dynamicImports = collectDynamicImportDetails(sourceConverterContent).filter((detail) => {
      const resolved = path.resolve(path.dirname(sourceConverterPath), detail.specifier);
      return detail.specifier.startsWith('.') && resolved.startsWith(strictSanitizerSourceRoot);
    });
    expect(dynamicImports).toHaveLength(1);
    expect(dynamicImports[0]).toEqual({
      specifier: '../svg-sanitizer',
      enclosingFunctionName: 'sanitizeSvgStrictForProcessing',
    });

    expect(collectDynamicImportSpecifiers(sourceConverterContent)).toContain('../svg-sanitizer');
  });
});
