/**
 * 이미지 포맷(Canvas encoder · WebP · AVIF) 지원 여부를 감지하는 함수 모음이다.
 *
 * @description `detectCanvasFormatSupport`는 Canvas의 toDataURL 결과로 즉시 판단하고,
 * `detectWebPSupport`/`detectAVIFSupport`는 1x1 데이터 URL을 실제 디코드해 비동기로 확인한다.
 * 두 경로는 의미가 다르므로 캐시 키를 분리해서 보관한다.
 */

import type { ImageFormat } from '../../types';
import { createImageElement } from '../image-element';
import { capabilityCache } from './cache';
import type { BrowserCapabilities } from './types';

function getCanvasFormatCacheKey(format: ImageFormat): string {
  return `canvas-format-support:${format}`;
}

function getCanvasMimeType(format: ImageFormat): string {
  return format === 'jpg' ? 'image/jpeg' : `image/${format}`;
}

/**
 * Canvas encoder가 특정 출력 포맷을 지원하는지 동기적으로 감지한다.
 *
 * @description `processImage().toBlob()`의 smart format 선택과 하위 호환
 * `features` 퍼사드가 공유하는 Canvas 기반 encode 지원 캐시다. 비동기
 * image-load 기반 `detectFormatSupport()`와 의미가 다르므로 별도 키를 쓴다.
 */
export function detectCanvasFormatSupport(format: ImageFormat): boolean {
  const cached = capabilityCache.get<boolean>(getCanvasFormatCacheKey(format));
  if (cached !== undefined) return cached;

  if (capabilityCache.isServerSide) {
    return false;
  }

  try {
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = canvas.height = 1;

    const mimeType = getCanvasMimeType(format);
    const supported = canvas.toDataURL(mimeType, 0.5).startsWith(`data:${mimeType}`);
    capabilityCache.set(getCanvasFormatCacheKey(format), supported);
    return supported;
  } catch {
    capabilityCache.set(getCanvasFormatCacheKey(format), false);
    return false;
  }
}

/**
 * Detect WebP support asynchronously
 */
export async function detectWebPSupport(timeout: number = 5000): Promise<boolean> {
  if (capabilityCache.isServerSide) return false;

  const cached = capabilityCache.get<boolean>('webp');
  if (cached !== undefined) return cached;

  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => resolve(false), timeout);

    try {
      const img = createImageElement();

      img.onload = () => {
        clearTimeout(timeoutId);
        const supported = img.width === 1 && img.height === 1;
        capabilityCache.set('webp', supported);
        resolve(supported);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        capabilityCache.set('webp', false);
        resolve(false);
      };

      // 1x1 WebP image (transparent)
      img.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
    } catch {
      clearTimeout(timeoutId);
      capabilityCache.set('webp', false);
      resolve(false);
    }
  });
}

/**
 * Detect AVIF support asynchronously
 */
export async function detectAVIFSupport(timeout: number = 5000): Promise<boolean> {
  if (capabilityCache.isServerSide) return false;

  const cached = capabilityCache.get<boolean>('avif');
  if (cached !== undefined) return cached;

  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => resolve(false), timeout);

    try {
      const img = createImageElement();

      img.onload = () => {
        clearTimeout(timeoutId);
        const supported = img.width === 1 && img.height === 1;
        capabilityCache.set('avif', supported);
        resolve(supported);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        capabilityCache.set('avif', false);
        resolve(false);
      };

      // 1x1 AVIF image (transparent)
      img.src =
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    } catch {
      clearTimeout(timeoutId);
      capabilityCache.set('avif', false);
      resolve(false);
    }
  });
}

/**
 * 두 비동기 포맷 감지를 병렬로 수행한다.
 */
export async function detectFormatSupport(timeout: number = 5000): Promise<{ webp: boolean; avif: boolean }> {
  const [webp, avif] = await Promise.all([detectWebPSupport(timeout), detectAVIFSupport(timeout)]);
  return { webp, avif };
}

/**
 * 현재 캐시에 저장된 포맷 감지 결과를 동기적으로 읽는다.
 *
 * 감지가 아직 수행되지 않았다면 해당 필드는 undefined다.
 */
export function getCachedFormatSupport(): Partial<Pick<BrowserCapabilities, 'webp' | 'avif'>> {
  return {
    webp: capabilityCache.get<boolean>('webp'),
    avif: capabilityCache.get<boolean>('avif'),
  };
}
