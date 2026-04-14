/**
 * 이미지 로딩 경로 회귀를 막기 위한 안전장치 테스트다.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
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
});
