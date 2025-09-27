/**
 * 결과 객체 구현 클래스들
 * 크기 정보를 재사용하여 성능을 최적화하는 직접 변환 메서드들 제공
 */

import { ImageProcessError } from './index';
import type {
  ResultDataURL,
  ResultBlob,
  ResultFile,
  OutputOptions,
  OutputFormat,
  GeometrySize
} from './index';

/**
 * DataURL 결과 구현 클래스
 * 크기 정보를 이미 알고 있으므로 효율적인 변환이 가능
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

  /**
   * Canvas로 변환 (크기 정보 재사용으로 최적화)
   */
  async toCanvas(): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // 🎯 크기 정보를 이미 알고 있으므로 미리 설정
    canvas.width = this.width;
    canvas.height = this.height;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new ImageProcessError('이미지 로딩 실패', 'IMAGE_LOAD_FAILED'));
      img.src = this.dataURL;
    });

    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  /**
   * Blob으로 변환
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    const canvas = await this.toCanvas();
    return new Promise((resolve, reject) => {
      const mimeType = options?.format ? `image/${options.format}` : 'image/png';
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new ImageProcessError('Blob 변환 실패', 'CANVAS_TO_BLOB_FAILED'));
        }
      }, mimeType, options?.quality);
    });
  }

  /**
   * File 객체로 변환
   */
  async toFile(filename: string, options?: OutputOptions): Promise<globalThis.File> {
    const blob = await this.toBlob(options);
    return new File([blob], filename, {
      type: blob.type,
      lastModified: Date.now(),
    });
  }

  /**
   * HTMLImageElement로 변환
   */
  async toElement(): Promise<HTMLImageElement> {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new ImageProcessError('이미지 로딩 실패', 'IMAGE_LOAD_FAILED'));
      img.src = this.dataURL;
    });
    return img;
  }

  /**
   * ArrayBuffer로 변환
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    const blob = await this.toBlob();
    return await blob.arrayBuffer();
  }

  /**
   * Uint8Array로 변환
   */
  async toUint8Array(): Promise<Uint8Array> {
    const arrayBuffer = await this.toArrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}

/**
 * Blob 결과 구현 클래스
 */
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
   * Canvas로 변환
   */
  async toCanvas(): Promise<HTMLCanvasElement> {
    const objectUrl = URL.createObjectURL(this.blob);

    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new ImageProcessError('이미지 로딩 실패', 'IMAGE_LOAD_FAILED'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // 🎯 크기 정보 재사용
      canvas.width = this.width;
      canvas.height = this.height;

      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(objectUrl); // 즉시 정리
    }
  }

  /**
   * DataURL로 변환
   */
  async toDataURL(options?: OutputOptions): Promise<string> {
    const canvas = await this.toCanvas();
    const mimeType = options?.format ? `image/${options.format}` : 'image/png';
    return canvas.toDataURL(mimeType, options?.quality);
  }

  /**
   * File 객체로 변환
   */
  async toFile(filename: string, options?: OutputOptions): Promise<globalThis.File> {
    if (!options) {
      // 옵션이 없으면 기존 Blob을 그대로 사용
      return new File([this.blob], filename, {
        type: this.blob.type,
        lastModified: Date.now(),
      });
    }

    // 옵션이 있으면 재변환
    const newBlob = await this.toBlob(options);
    return new File([newBlob], filename, {
      type: newBlob.type,
      lastModified: Date.now(),
    });
  }

  /**
   * Blob으로 변환 (옵션에 따라 재변환)
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    if (!options) {
      return this.blob; // 옵션이 없으면 기존 Blob 반환
    }

    const canvas = await this.toCanvas();
    return new Promise((resolve, reject) => {
      const mimeType = options.format ? `image/${options.format}` : this.blob.type;
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new ImageProcessError('Blob 변환 실패', 'CANVAS_TO_BLOB_FAILED'));
        }
      }, mimeType, options.quality);
    });
  }

  /**
   * HTMLImageElement로 변환
   */
  async toElement(): Promise<HTMLImageElement> {
    const objectUrl = URL.createObjectURL(this.blob);

    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new ImageProcessError('이미지 로딩 실패', 'IMAGE_LOAD_FAILED'));
        img.src = objectUrl;
      });
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl); // 즉시 정리
    }
  }

  /**
   * ArrayBuffer로 변환
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    return await this.blob.arrayBuffer();
  }

  /**
   * Uint8Array로 변환
   */
  async toUint8Array(): Promise<Uint8Array> {
    const arrayBuffer = await this.toArrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}

/**
 * File 결과 구현 클래스
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
   * Canvas로 변환
   */
  async toCanvas(): Promise<HTMLCanvasElement> {
    const objectUrl = URL.createObjectURL(this.file);

    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new ImageProcessError('이미지 로딩 실패', 'IMAGE_LOAD_FAILED'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // 🎯 크기 정보 재사용
      canvas.width = this.width;
      canvas.height = this.height;

      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(objectUrl); // 즉시 정리
    }
  }

  /**
   * DataURL로 변환
   */
  async toDataURL(options?: OutputOptions): Promise<string> {
    const canvas = await this.toCanvas();
    const mimeType = options?.format ? `image/${options.format}` : 'image/png';
    return canvas.toDataURL(mimeType, options?.quality);
  }

  /**
   * Blob으로 변환
   */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    if (!options) {
      return this.file; // 옵션이 없으면 기존 File을 Blob으로 반환
    }

    const canvas = await this.toCanvas();
    return new Promise((resolve, reject) => {
      const mimeType = options.format ? `image/${options.format}` : this.file.type;
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new ImageProcessError('Blob 변환 실패', 'CANVAS_TO_BLOB_FAILED'));
        }
      }, mimeType, options.quality);
    });
  }

  /**
   * HTMLImageElement로 변환
   */
  async toElement(): Promise<HTMLImageElement> {
    const objectUrl = URL.createObjectURL(this.file);

    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new ImageProcessError('이미지 로딩 실패', 'IMAGE_LOAD_FAILED'));
        img.src = objectUrl;
      });
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl); // 즉시 정리
    }
  }

  /**
   * ArrayBuffer로 변환
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    return await this.file.arrayBuffer();
  }

  /**
   * Uint8Array로 변환
   */
  async toUint8Array(): Promise<Uint8Array> {
    const arrayBuffer = await this.toArrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}