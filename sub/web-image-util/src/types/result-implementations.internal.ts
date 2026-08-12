/**
 * 결과 객체의 실제 변환 동작을 담당하는 구현 모음이다.
 *
 * @description 이미 알고 있는 크기 정보를 재사용해 후속 변환 비용을 줄인다.
 */

import { createOwnedCanvas } from '../base/canvas-utils.internal';
import { createImageElement } from '../utils/image-element.internal';
import { loadImageElement } from '../utils/image-loader.internal';
import type {
  GeometrySize,
  OutputFormat,
  OutputOptions,
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultElement,
  ResultFile,
} from './index';
import {
  blobToArrayBuffer,
  blobToUint8Array,
  canvasToBlob,
  canvasToDataURL,
  createFileFromBlob,
} from './result-conversion-helpers.internal';

/**
 * Data URL 결과 객체 구현이다.
 *
 * @description 계산된 크기 정보를 활용해 후속 변환을 단순화한다.
 */
export class DataURLResultImpl implements ResultDataURL {
  constructor(
    public dataURL: string,
    public width: number,
    public height: number,
    public processingTime: number,
    public originalSize?: GeometrySize,
    public format?: OutputFormat
  ) {}

  /** 크기 정보를 재사용해 Canvas로 변환한다. */
  async toCanvas(): Promise<HTMLCanvasElement> {
    // 결과를 호출자에게 넘기므로 owned canvas — 이미 계산된 결과 크기를 그대로 쓴다
    const { canvas, ctx } = createOwnedCanvas(this.width, this.height);

    const img = createImageElement();
    await loadImageElement(img, this.dataURL);

    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  /** Blob으로 변환한다. */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    const canvas = await this.toCanvas();
    return canvasToBlob(canvas, options);
  }

  /** File 객체로 변환한다. */
  async toFile(filename: string, options?: OutputOptions): Promise<globalThis.File> {
    const blob = await this.toBlob(options);
    return createFileFromBlob(blob, filename);
  }

  /** HTMLImageElement로 변환한다. */
  async toElement(): Promise<HTMLImageElement> {
    const img = createImageElement();
    await loadImageElement(img, this.dataURL);
    return img;
  }

  /** ArrayBuffer로 변환한다. */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    const blob = await this.toBlob();
    return await blobToArrayBuffer(blob);
  }

  /** Uint8Array로 변환한다. */
  async toUint8Array(): Promise<Uint8Array> {
    const blob = await this.toBlob();
    return await blobToUint8Array(blob);
  }
}

/** Blob 결과 객체 구현이다. */
export class BlobResultImpl implements ResultBlob {
  constructor(
    public blob: globalThis.Blob,
    public width: number,
    public height: number,
    public processingTime: number,
    public originalSize?: GeometrySize,
    public format?: OutputFormat
  ) {}

  /**
   * Convert to Canvas
   */
  async toCanvas(): Promise<HTMLCanvasElement> {
    const objectUrl = URL.createObjectURL(this.blob);

    try {
      const img = createImageElement();
      await loadImageElement(img, objectUrl);

      // 결과를 호출자에게 넘기므로 owned canvas — 이미 계산된 결과 크기를 그대로 쓴다
      const { canvas, ctx } = createOwnedCanvas(this.width, this.height);

      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Convert to DataURL
   */
  async toDataURL(options?: OutputOptions): Promise<string> {
    const canvas = await this.toCanvas();
    return canvasToDataURL(canvas, options);
  }

  /**
   * Convert to File object
   */
  async toFile(filename: string, options?: OutputOptions): Promise<globalThis.File> {
    if (!options) {
      // Use existing Blob as-is if no options provided
      return new File([this.blob], filename, {
        type: this.blob.type,
        lastModified: Date.now(),
      });
    }

    // Re-convert if options are provided
    const newBlob = await this.toBlob(options);
    return createFileFromBlob(newBlob, filename);
  }

  /**
   * Convert to Blob (re-convert based on options)
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    if (!options) {
      return this.blob; // Return existing Blob if no options provided
    }

    const canvas = await this.toCanvas();
    return canvasToBlob(canvas, options, this.blob.type);
  }

  /**
   * Convert to HTMLImageElement
   */
  async toElement(): Promise<HTMLImageElement> {
    const objectUrl = URL.createObjectURL(this.blob);

    try {
      const img = createImageElement();
      await loadImageElement(img, objectUrl);
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Convert to ArrayBuffer
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    return await blobToArrayBuffer(this.blob);
  }

  /**
   * Convert to Uint8Array
   */
  async toUint8Array(): Promise<Uint8Array> {
    return await blobToUint8Array(this.blob);
  }
}

/**
 * File result implementation class
 */
export class FileResultImpl implements ResultFile {
  constructor(
    public file: globalThis.File,
    public width: number,
    public height: number,
    public processingTime: number,
    public originalSize?: GeometrySize,
    public format?: OutputFormat
  ) {}

  /**
   * Convert to Canvas
   */
  async toCanvas(): Promise<HTMLCanvasElement> {
    const objectUrl = URL.createObjectURL(this.file);

    try {
      const img = createImageElement();
      await loadImageElement(img, objectUrl);

      // 결과를 호출자에게 넘기므로 owned canvas — 이미 계산된 결과 크기를 그대로 쓴다
      const { canvas, ctx } = createOwnedCanvas(this.width, this.height);

      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Convert to DataURL
   */
  async toDataURL(options?: OutputOptions): Promise<string> {
    const canvas = await this.toCanvas();
    return canvasToDataURL(canvas, options);
  }

  /**
   * Convert to Blob
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    if (!options) {
      return this.file; // Return existing File as Blob if no options provided
    }

    const canvas = await this.toCanvas();
    return canvasToBlob(canvas, options, this.file.type);
  }

  /**
   * Convert to HTMLImageElement
   */
  async toElement(): Promise<HTMLImageElement> {
    const objectUrl = URL.createObjectURL(this.file);

    try {
      const img = createImageElement();
      await loadImageElement(img, objectUrl);
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Convert to ArrayBuffer
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    return await blobToArrayBuffer(this.file);
  }

  /**
   * Convert to Uint8Array
   */
  async toUint8Array(): Promise<Uint8Array> {
    return await blobToUint8Array(this.file);
  }
}

/**
 * Canvas result implementation class
 */
export class CanvasResultImpl implements ResultCanvas {
  constructor(
    public canvas: HTMLCanvasElement,
    public width: number,
    public height: number,
    public processingTime: number,
    public originalSize?: GeometrySize,
    public format?: OutputFormat
  ) {}

  /**
   * Convert to DataURL
   */
  async toDataURL(options?: OutputOptions): Promise<string> {
    return canvasToDataURL(this.canvas, options);
  }

  /**
   * Convert to Blob
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    return canvasToBlob(this.canvas, options);
  }

  /**
   * Convert to File object
   */
  async toFile(filename: string, options?: OutputOptions): Promise<globalThis.File> {
    const blob = await this.toBlob(options);
    return createFileFromBlob(blob, filename);
  }

  /**
   * Convert to HTMLImageElement
   */
  async toElement(): Promise<HTMLImageElement> {
    const dataURL = await this.toDataURL();
    const img = createImageElement();
    await loadImageElement(img, dataURL);
    return img;
  }

  /**
   * Convert to ArrayBuffer
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    const blob = await this.toBlob();
    return await blobToArrayBuffer(blob);
  }

  /**
   * Convert to Uint8Array
   */
  async toUint8Array(): Promise<Uint8Array> {
    const blob = await this.toBlob();
    return await blobToUint8Array(blob);
  }
}

/**
 * HTMLImageElement 결과 객체 구현이다.
 *
 * @description 이미 로드된 element를 보유하고, 후속 변환에서 재사용한다.
 */
export class ElementResultImpl implements ResultElement {
  constructor(
    public element: HTMLImageElement,
    public width: number,
    public height: number,
    public processingTime: number,
    public originalSize?: GeometrySize,
    public format?: OutputFormat
  ) {}

  /** Canvas로 변환한다. 이미 알고 있는 크기를 그대로 사용한다. */
  async toCanvas(): Promise<HTMLCanvasElement> {
    // 결과를 호출자에게 넘기므로 owned canvas
    const { canvas, ctx } = createOwnedCanvas(this.width, this.height);

    ctx.drawImage(this.element, 0, 0);
    return canvas;
  }

  /** Blob으로 변환한다. */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    const canvas = await this.toCanvas();
    return canvasToBlob(canvas, options);
  }

  /** Data URL로 변환한다. */
  async toDataURL(options?: OutputOptions): Promise<string> {
    const canvas = await this.toCanvas();
    return canvasToDataURL(canvas, options);
  }

  /** File 객체로 변환한다. */
  async toFile(filename: string, options?: OutputOptions): Promise<globalThis.File> {
    const blob = await this.toBlob(options);
    return createFileFromBlob(blob, filename);
  }

  /** ArrayBuffer로 변환한다. */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    const blob = await this.toBlob();
    return await blobToArrayBuffer(blob);
  }

  /** Uint8Array로 변환한다. */
  async toUint8Array(): Promise<Uint8Array> {
    const blob = await this.toBlob();
    return await blobToUint8Array(blob);
  }
}
