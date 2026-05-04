export const ImageErrorCode = {
  INVALID_SOURCE: 'INVALID_SOURCE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  SOURCE_LOAD_FAILED: 'SOURCE_LOAD_FAILED',
  SOURCE_BYTES_EXCEEDED: 'SOURCE_BYTES_EXCEEDED',
  CANVAS_CREATION_FAILED: 'CANVAS_CREATION_FAILED',
  CANVAS_CONTEXT_FAILED: 'CANVAS_CONTEXT_FAILED',
  RESIZE_FAILED: 'RESIZE_FAILED',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  BLUR_FAILED: 'BLUR_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  SMART_RESIZE_FAILED: 'SMART_RESIZE_FAILED',
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS',
  DIMENSION_TOO_LARGE: 'DIMENSION_TOO_LARGE',
  MEMORY_ERROR: 'MEMORY_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SVG_LOAD_FAILED: 'SVG_LOAD_FAILED',
  SVG_PROCESSING_FAILED: 'SVG_PROCESSING_FAILED',
  OUTPUT_FAILED: 'OUTPUT_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  CANVAS_TO_BLOB_FAILED: 'CANVAS_TO_BLOB_FAILED',
  IMAGE_LOAD_FAILED: 'IMAGE_LOAD_FAILED',
  BLOB_TO_ARRAYBUFFER_FAILED: 'BLOB_TO_ARRAYBUFFER_FAILED',
  BLOB_CONVERSION_ERROR: 'BLOB_CONVERSION_ERROR',
  MULTIPLE_RESIZE_NOT_ALLOWED: 'MULTIPLE_RESIZE_NOT_ALLOWED',
  CANVAS_CONTEXT_ERROR: 'CANVAS_CONTEXT_ERROR',
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
  FEATURE_NOT_SUPPORTED: 'FEATURE_NOT_SUPPORTED',
  OPTION_INVALID: 'OPTION_INVALID',
  SVG_INPUT_INVALID: 'SVG_INPUT_INVALID',
  SVG_DOMPURIFY_INIT_FAILED: 'SVG_DOMPURIFY_INIT_FAILED',
  SVG_NODE_COUNT_EXCEEDED: 'SVG_NODE_COUNT_EXCEEDED',
  SVG_BYTES_EXCEEDED: 'SVG_BYTES_EXCEEDED',
  INVALID_DATA_URL: 'INVALID_DATA_URL',
  INVALID_SVG_DATA_URL: 'INVALID_SVG_DATA_URL',
} as const;

export type ImageErrorCodeType = (typeof ImageErrorCode)[keyof typeof ImageErrorCode];

export interface ImageErrorDetailsByCode {
  INVALID_SOURCE: {
    url?: string;
    source?: string;
    contentType?: string | null;
    mode?: unknown;
    reason?: 'script-tag' | 'event-handler' | 'external-ref' | 'style-attribute-url' | 'style-tag-url';
    label?: string;
  };
  SOURCE_LOAD_FAILED: {
    url?: string;
    source?: string;
    kind?: 'aborted' | 'response-body' | 'fetch';
  };
  SOURCE_BYTES_EXCEEDED: { actualBytes: number; maxBytes: number; label?: string };
  SVG_BYTES_EXCEEDED: { actualBytes: number; maxBytes: number; label?: string };
  SVG_NODE_COUNT_EXCEEDED: { actualCount: number; maxCount: number };
  SVG_INPUT_INVALID: { actualType: string };
  OPTION_INVALID: { option: string; minimum?: number };
  INVALID_DIMENSIONS: {
    kind?: 'invalid-canvas-size' | 'invalid-image-size' | 'invalid-position';
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
  INVALID_DATA_URL: { kind: 'malformed' | 'invalid-base64' | 'invalid-percent' };
}

export type ImageErrorDetails = Partial<ImageErrorDetailsByCode[keyof ImageErrorDetailsByCode]> &
  Record<string, unknown>;

export interface ImageProcessErrorOptions {
  /** 원인 에러. 표준 `Error.cause` 필드로 보존된다. */
  cause?: unknown;
  /** 호출자가 분기 가능해야 하는 구조화된 컨텍스트. */
  details?: ImageErrorDetails;
}

export class ImageProcessError extends globalThis.Error {
  public readonly name: string = 'ImageProcessError';
  public readonly code: ImageErrorCodeType;
  public readonly cause?: unknown;
  public readonly details?: ImageErrorDetails;

  constructor(message: string, code: ImageErrorCodeType, options?: ImageProcessErrorOptions) {
    super(message);
    this.code = code;
    this.cause = options?.cause;
    this.details = options?.details;

    if ((globalThis.Error as any).captureStackTrace) {
      (globalThis.Error as any).captureStackTrace(this, ImageProcessError);
    }
  }
}
