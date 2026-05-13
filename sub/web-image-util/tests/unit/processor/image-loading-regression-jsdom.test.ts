/**
 * 이미지 로딩 경로 회귀 안전장치 중 jsdom에서 안전한 케이스를 모은다.
 *
 * 분리 기준:
 * - 파일 시스템 정적 분석 케이스(소스에 `new Image()` / strict sanitizer 정적 import 금지)는
 *   DOM 의존성이 없어 jsdom에서 그대로 통과한다.
 *
 * toElement 흐름 케이스는 production이 내부에서 Blob → createObjectURL → Image.src 경로를 거쳐
 * jsdom + canvas 패키지에서 IMAGE_LOAD_FAILED로 거부되므로 `image-loading-regression.test.ts`(happy-dom)에 남긴다.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
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

function collectDynamicImportSpecifiers(sourceText: string): string[] {
  return collectDynamicImportDetails(sourceText).map((detail) => detail.specifier);
}

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
    const svgLoaderPath = path.resolve(srcRoot, 'core/source-converter/svg/loader.ts');
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
