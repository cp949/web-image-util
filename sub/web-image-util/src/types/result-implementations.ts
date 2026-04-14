/**
 * 결과 객체의 실제 변환 동작을 담당하는 구현 모음이다.
 *
 * @description 이미 알고 있는 크기 정보를 재사용해 후속 변환 비용을 줄인다.
 */

import { createImageElement } from '../utils/image-element';
import type {
  GeometrySize,
  OutputFormat,
  OutputOptions,
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultFile,
} from './index';
import { ImageProcessError } from './index';

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
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // 이미 계산된 결과 크기를 그대로 캔버스에 반영한다.
    canvas.width = this.width;
    canvas.height = this.height;

    const img = createImageElement();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
      img.src = this.dataURL;
    });

    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  /** Blob으로 변환한다. */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    const canvas = await this.toCanvas();
    return new Promise((resolve, reject) => {
      const mimeType = options?.format ? `image/${options.format}` : 'image/png';
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new ImageProcessError('Blob conversion failed', 'CANVAS_TO_BLOB_FAILED'));
          }
        },
        mimeType,
        options?.quality
      );
    });
  }

  /** File 객체로 변환한다. */
  async toFile(filename: string, options?: OutputOptions): Promise<globalThis.File> {
    const blob = await this.toBlob(options);
    return new File([blob], filename, {
      type: blob.type,
      lastModified: Date.now(),
    });
  }

  /** HTMLImageElement로 변환한다. */
  async toElement(): Promise<HTMLImageElement> {
    const img = createImageElement();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
      img.src = this.dataURL;
    });
    return img;
  }

  /** ArrayBuffer로 변환한다. */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    const blob = await this.toBlob();
    return await blob.arrayBuffer();
  }

  /** Uint8Array로 변환한다. */
  async toUint8Array(): Promise<Uint8Array> {
    const arrayBuffer = await this.toArrayBuffer();
    return new Uint8Array(arrayBuffer);
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
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // 🎯 Reuse size information
      canvas.width = this.width;
      canvas.height = this.height;

      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(objectUrl); // Immediate cleanup
    }
  }

  /**
   * Convert to DataURL
   */
  async toDataURL(options?: OutputOptions): Promise<string> {
    const canvas = await this.toCanvas();
    const mimeType = options?.format ? `image/${options.format}` : 'image/png';
    return canvas.toDataURL(mimeType, options?.quality);
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
    return new File([newBlob], filename, {
      type: newBlob.type,
      lastModified: Date.now(),
    });
  }

  /**
   * Convert to Blob (re-convert based on options)
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    if (!options) {
      return this.blob; // Return existing Blob if no options provided
    }

    const canvas = await this.toCanvas();
    return new Promise((resolve, reject) => {
      const mimeType = options.format ? `image/${options.format}` : this.blob.type;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new ImageProcessError('Blob conversion failed', 'CANVAS_TO_BLOB_FAILED'));
          }
        },
        mimeType,
        options.quality
      );
    });
  }

  /**
   * Convert to HTMLImageElement
   */
  async toElement(): Promise<HTMLImageElement> {
    const objectUrl = URL.createObjectURL(this.blob);

    try {
      const img = createImageElement();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
        img.src = objectUrl;
      });
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl); // Immediate cleanup
    }
  }

  /**
   * Convert to ArrayBuffer
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    return await this.blob.arrayBuffer();
  }

  /**
   * Convert to Uint8Array
   */
  async toUint8Array(): Promise<Uint8Array> {
    const arrayBuffer = await this.toArrayBuffer();
    return new Uint8Array(arrayBuffer);
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
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // 🎯 Reuse size information
      canvas.width = this.width;
      canvas.height = this.height;

      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(objectUrl); // Immediate cleanup
    }
  }

  /**
   * Convert to DataURL
   */
  async toDataURL(options?: OutputOptions): Promise<string> {
    const canvas = await this.toCanvas();
    const mimeType = options?.format ? `image/${options.format}` : 'image/png';
    return canvas.toDataURL(mimeType, options?.quality);
  }

  /**
   * Convert to Blob
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    if (!options) {
      return this.file; // Return existing File as Blob if no options provided
    }

    const canvas = await this.toCanvas();
    return new Promise((resolve, reject) => {
      const mimeType = options.format ? `image/${options.format}` : this.file.type;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new ImageProcessError('Blob conversion failed', 'CANVAS_TO_BLOB_FAILED'));
          }
        },
        mimeType,
        options.quality
      );
    });
  }

  /**
   * Convert to HTMLImageElement
   */
  async toElement(): Promise<HTMLImageElement> {
    const objectUrl = URL.createObjectURL(this.file);

    try {
      const img = createImageElement();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
        img.src = objectUrl;
      });
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl); // Immediate cleanup
    }
  }

  /**
   * Convert to ArrayBuffer
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    return await this.file.arrayBuffer();
  }

  /**
   * Convert to Uint8Array
   */
  async toUint8Array(): Promise<Uint8Array> {
    const arrayBuffer = await this.toArrayBuffer();
    return new Uint8Array(arrayBuffer);
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
    const mimeType = options?.format ? `image/${options.format}` : 'image/png';
    return this.canvas.toDataURL(mimeType, options?.quality);
  }

  /**
   * Convert to Blob
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    return new Promise((resolve, reject) => {
      const mimeType = options?.format ? `image/${options.format}` : 'image/png';
      this.canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new ImageProcessError('Blob conversion failed', 'CANVAS_TO_BLOB_FAILED'));
          }
        },
        mimeType,
        options?.quality
      );
    });
  }

  /**
   * Convert to File object
   */
  async toFile(filename: string, options?: OutputOptions): Promise<globalThis.File> {
    const blob = await this.toBlob(options);
    return new File([blob], filename, {
      type: blob.type,
      lastModified: Date.now(),
    });
  }

  /**
   * Convert to HTMLImageElement
   */
  async toElement(): Promise<HTMLImageElement> {
    const dataURL = await this.toDataURL();
    const img = createImageElement();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
      img.src = dataURL;
    });
    return img;
  }

  /**
   * Convert to ArrayBuffer
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    const blob = await this.toBlob();
    return await blob.arrayBuffer();
  }

  /**
   * Convert to Uint8Array
   */
  async toUint8Array(): Promise<Uint8Array> {
    const arrayBuffer = await this.toArrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}
