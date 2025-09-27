/**
 * 이미지 리사이징 핵심 로직
 * 이미지 리사이징 핵심 함수들
 */

// Canvas 풀링은 pipeline.ts에서 처리됨

// 유틸리티 함수들은 processor pipeline에서 처리됨

/**
 * Canvas를 Blob으로 변환
 *
 * @param canvas - 변환할 Canvas 요소
 * @param format - MIME 타입 (예: 'image/jpeg', 'image/png')
 * @param quality - 품질 (0.0 - 1.0, 손실 압축 포맷에만 적용)
 * @returns Blob 객체를 반환하는 Promise
 *
 * @example
 * ```typescript
 * const blob = await canvasToBlob(canvas, 'image/jpeg', 0.8);
 * ```
 */
export function canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas to Blob 변환 실패'));
        }
      },
      format,
      quality
    );
  });
}

/**
 * Canvas를 Data URL로 변환
 *
 * @param canvas - 변환할 Canvas 요소
 * @param format - MIME 타입 (예: 'image/jpeg', 'image/png')
 * @param quality - 품질 (0.0 - 1.0, 손실 압축 포맷에만 적용)
 * @returns Base64 인코딩된 Data URL 문자열
 *
 * @example
 * ```typescript
 * const dataUrl = canvasToDataUrl(canvas, 'image/png', 1.0);
 * imageElement.src = dataUrl;
 * ```
 */
export function canvasToDataUrl(canvas: HTMLCanvasElement, format: string, quality: number): string {
  return canvas.toDataURL(format, quality);
}

// 브라우저 Canvas API 기반 리사이징 구현
// toCenterCrop, toCenterInside, toFill, toFit 등은 더 이상 사용하지 않음
// 새로운 processor.ts의 pipeline 시스템 사용
