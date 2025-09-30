// 에러 처리 유틸리티 - ImageProcessError 활용

import { ImageProcessError } from '@cp949/web-image-util';

/**
 * 에러를 사용자 친화적 메시지로 변환
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ImageProcessError) {
    switch (error.code) {
      case 'INVALID_SOURCE':
        return '지원하지 않는 이미지 형식입니다. JPG, PNG, WebP, SVG 파일을 사용해주세요.';
      case 'SOURCE_LOAD_FAILED':
        return '이미지를 불러올 수 없습니다. 파일이 손상되었거나 접근할 수 없습니다.';
      case 'CANVAS_CREATION_FAILED':
        return '이미지 처리 중 오류가 발생했습니다. 브라우저를 새로고침해주세요.';
      case 'OUTPUT_FAILED':
        return '결과 이미지 생성에 실패했습니다. 다른 형식으로 시도해보세요.';
      default:
        return `이미지 처리 오류: ${error.message}`;
    }
  }

  if (error instanceof Error) {
    return `오류: ${error.message}`;
  }

  return '알 수 없는 오류가 발생했습니다.';
}

/**
 * 복구 가능한 에러인지 확인
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof ImageProcessError) {
    // OUTPUT_FAILED는 옵션 변경으로 복구 가능
    return error.code === 'OUTPUT_FAILED';
  }
  return false;
}

/**
 * 에러 심각도 확인
 */
export function getErrorSeverity(error: unknown): 'error' | 'warning' | 'info' {
  if (error instanceof ImageProcessError) {
    switch (error.code) {
      case 'CANVAS_CREATION_FAILED':
      case 'SOURCE_LOAD_FAILED':
        return 'error';
      case 'OUTPUT_FAILED':
        return 'warning';
      default:
        return 'info';
    }
  }
  return 'error';
}

/**
 * 에러 로깅 (개발 환경에서만)
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🔴 Error${context ? ` in ${context}` : ''}`);
    console.error(error);
    if (error instanceof ImageProcessError) {
      console.log('Error Code:', error.code);
      console.log('Error Message:', error.message);
    }
    console.groupEnd();
  }
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 처리 시간 포맷팅
 */
export function formatProcessingTime(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}