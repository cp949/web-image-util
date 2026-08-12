/**
 * 결과 객체의 실제 변환 동작을 담당하는 구현 모음이다.
 *
 * @description 이미 알고 있는 크기 정보를 재사용해 후속 변환 비용을 줄인다.
 *   파생 변환(`toDataURL`/`toBlob`/`toFile`/`toArrayBuffer`/`toUint8Array`)은
 *   [ResultBase](./result-base.internal.ts)가 소유하고, 각 클래스는 소스별로
 *   다른 부분(canvas·element 로딩, 재인코딩 없는 fast-path)만 채운다.
 */

import type {
  GeometrySize,
  OutputFormat,
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultElement,
  ResultFile,
} from './index';
import { BlobBackedResult, ResultBase } from './result-base.internal';
import { drawToOwnedCanvas, loadImageFromUrl } from './result-conversion-helpers.internal';

/**
 * Data URL 결과 객체 구현이다.
 *
 * @description 계산된 크기 정보를 활용해 후속 변환을 단순화한다.
 */
export class DataURLResultImpl extends ResultBase implements ResultDataURL {
  constructor(
    public dataURL: string,
    width: number,
    height: number,
    processingTime: number,
    originalSize?: GeometrySize,
    format?: OutputFormat
  ) {
    super(width, height, processingTime, originalSize, format);
  }

  /** 크기 정보를 재사용해 Canvas로 변환한다. */
  async toCanvas(): Promise<HTMLCanvasElement> {
    const img = await loadImageFromUrl(this.dataURL);
    // 결과를 호출자에게 넘기므로 owned canvas — 이미 계산된 결과 크기를 그대로 쓴다
    return drawToOwnedCanvas(img, this.width, this.height);
  }

  /** HTMLImageElement로 변환한다. */
  async toElement(): Promise<HTMLImageElement> {
    return loadImageFromUrl(this.dataURL);
  }

  /** 재인코딩 소스도 dataURL을 새로 로드해 그린 canvas다. */
  protected async renderCanvas(): Promise<HTMLCanvasElement> {
    return this.toCanvas();
  }
}

/**
 * Blob 결과 객체 구현이다.
 *
 * @description 옵션 없는 `toBlob()`/`toFile()`은 보유 중인 Blob을 그대로 쓴다.
 */
export class BlobResultImpl extends BlobBackedResult implements ResultBlob {
  constructor(
    public blob: globalThis.Blob,
    width: number,
    height: number,
    processingTime: number,
    originalSize?: GeometrySize,
    format?: OutputFormat
  ) {
    super(width, height, processingTime, originalSize, format);
  }

  /** 보유 Blob이 곧 원본 바이트다. */
  protected get payload(): globalThis.Blob {
    return this.blob;
  }
}

/**
 * File 결과 객체 구현이다.
 *
 * @description `File`은 `Blob`의 서브클래스이므로 옵션 없는 `toBlob()`은
 *   보유 중인 File을 그대로 반환한다.
 */
export class FileResultImpl extends BlobBackedResult implements ResultFile {
  constructor(
    public file: globalThis.File,
    width: number,
    height: number,
    processingTime: number,
    originalSize?: GeometrySize,
    format?: OutputFormat
  ) {
    super(width, height, processingTime, originalSize, format);
  }

  /** `File`은 `Blob`의 서브클래스이므로 보유 File이 그대로 원본 바이트다. */
  protected get payload(): globalThis.Blob {
    return this.file;
  }
}

/**
 * Canvas 결과 객체 구현이다.
 *
 * @description 이미 canvas를 보유하므로 재인코딩 소스로 그대로 쓴다.
 *   호출자 소유 canvas를 만드는 `toCanvas()`는 노출하지 않는다 —
 *   보유 중인 canvas를 그대로 넘기면 호출자가 결과를 변형할 수 있다.
 */
export class CanvasResultImpl extends ResultBase implements ResultCanvas {
  constructor(
    public canvas: HTMLCanvasElement,
    width: number,
    height: number,
    processingTime: number,
    originalSize?: GeometrySize,
    format?: OutputFormat
  ) {
    super(width, height, processingTime, originalSize, format);
  }

  /** HTMLImageElement로 변환한다. */
  async toElement(): Promise<HTMLImageElement> {
    const dataURL = await this.toDataURL();
    return loadImageFromUrl(dataURL);
  }

  /** 보유 중인 canvas가 곧 재인코딩 소스다 — 복사하지 않는다. */
  protected async renderCanvas(): Promise<HTMLCanvasElement> {
    return this.canvas;
  }
}

/**
 * HTMLImageElement 결과 객체 구현이다.
 *
 * @description 이미 로드된 element를 보유하고, 후속 변환에서 재사용한다.
 */
export class ElementResultImpl extends ResultBase implements ResultElement {
  constructor(
    public element: HTMLImageElement,
    width: number,
    height: number,
    processingTime: number,
    originalSize?: GeometrySize,
    format?: OutputFormat
  ) {
    super(width, height, processingTime, originalSize, format);
  }

  /** Canvas로 변환한다. 이미 알고 있는 크기를 그대로 사용한다. */
  async toCanvas(): Promise<HTMLCanvasElement> {
    // 결과를 호출자에게 넘기므로 owned canvas
    return drawToOwnedCanvas(this.element, this.width, this.height);
  }

  /** 재인코딩 소스도 보유 element를 새 canvas에 그린 결과다. */
  protected async renderCanvas(): Promise<HTMLCanvasElement> {
    return this.toCanvas();
  }
}
