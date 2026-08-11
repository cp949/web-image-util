/**
 * Processor 출력 계약 타입 leaf.
 *
 * 출력 결과(Result* 가족)와 출력·처리 옵션(OutputOptions, BlurOptions)의
 * 정의 지점이다 — 공개는 `types/index.ts`의 재export를 경유한다.
 * 구현은 `result-implementations.internal.ts`가 담당한다(타입↔구현 대칭).
 */

import type { GeometrySize, OutputFormat } from './base';

/**
 * Blur options (Canvas CSS filter limitations)
 */
export interface BlurOptions {
  /** Blur radius — 미지정 시 2, 0이면 블러 없음 */
  radius?: number;
  // Canvas only supports CSS filter blur(), so advanced options are removed
}

/**
 * Output options
 */
export interface OutputOptions {
  /** Output format (default: 'webp' if supported, 'png' if not) */
  format?: OutputFormat;
  /** Compression quality 0.0-1.0 (default: optimal value per format) */
  quality?: number;
  /** Fallback format when format not supported (default: 'png') */
  fallbackFormat?: OutputFormat;
}

/**
 * Basic processing result metadata
 */
export interface ResultMetadata {
  /** Result width */
  width: number;
  /** Result height */
  height: number;
  /** Processing time (milliseconds) */
  processingTime: number;
  /** Original size */
  originalSize?: GeometrySize;
  /** Format used */
  format?: OutputFormat;
  /** Result size (bytes) */
  size?: number;
  /** Number of operations applied */
  operations?: number;
}

/**
 * Blob result (includes metadata)
 */
export interface ResultBlob extends ResultMetadata {
  blob: globalThis.Blob;

  // 🆕 Additional metadata (test compatibility)
  /** Background color information (optional) */
  background?: string;
  /** Used quality setting (optional) */
  quality?: number;

  // 🆕 Direct conversion methods (performance optimization)
  toCanvas(): Promise<HTMLCanvasElement>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * DataURL result (includes metadata)
 */
export interface ResultDataURL extends ResultMetadata {
  dataURL: string;

  // 🆕 Direct conversion methods (performance optimization through size info reuse)
  toCanvas(): Promise<HTMLCanvasElement>;
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * File result (includes metadata)
 */
export interface ResultFile extends ResultMetadata {
  file: globalThis.File;

  // 🆕 Direct conversion methods
  toCanvas(): Promise<HTMLCanvasElement>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * Canvas result (includes metadata)
 */
export interface ResultCanvas extends ResultMetadata {
  canvas: HTMLCanvasElement;

  // Direct conversion methods
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * HTMLImageElement 결과 (메타데이터 포함)
 */
export interface ResultElement extends ResultMetadata {
  element: HTMLImageElement;

  // 직접 변환 메서드
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toCanvas(): Promise<HTMLCanvasElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}
