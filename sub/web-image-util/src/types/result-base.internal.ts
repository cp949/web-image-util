/**
 * 결과 객체 5종이 공유하는 파생 변환 구현이다.
 *
 * @description `toDataURL`/`toBlob`/`toFile`/`toArrayBuffer`/`toUint8Array`는
 *   전부 "재인코딩 소스 canvas 하나"에서 파생된다. 각 결과 타입이 채우는 것은
 *   그 소스를 만드는 방법(`renderCanvas`)과 기본 MIME뿐이다.
 */

import type { GeometrySize, OutputFormat, OutputOptions, ResultMetadata } from './index';
import {
  blobToArrayBuffer,
  blobToUint8Array,
  canvasToBlob,
  canvasToDataURL,
  createFileFromBlob,
  drawToOwnedCanvas,
  loadImageFromUrl,
  withObjectUrl,
} from './result-conversion-helpers.internal';

/**
 * 파생 변환 메서드를 소유하는 결과 객체 base다.
 *
 * @description 서브클래스는 `renderCanvas()`로 재인코딩 소스를 제공한다.
 *   `renderCanvas()`는 호출자에게 넘기는 `toCanvas()`와 다르다 —
 *   `toCanvas()`는 항상 새 canvas를 만들어야 하지만, `renderCanvas()`는
 *   내부 인코딩용이라 이미 canvas를 들고 있는 결과 타입이 복사를 건너뛸 수 있다.
 */
export abstract class ResultBase implements ResultMetadata {
  constructor(
    public width: number,
    public height: number,
    public processingTime: number,
    public originalSize?: GeometrySize,
    public format?: OutputFormat
  ) {}

  /**
   * 파생 변환이 재인코딩 소스로 쓸 canvas를 만든다.
   *
   * 결과 타입마다 소스 로딩 방식이 다르므로 서브클래스가 채운다.
   */
  protected abstract renderCanvas(): Promise<HTMLCanvasElement>;

  /**
   * `toBlob()`이 format 미지정일 때 쓸 기본 MIME이다.
   *
   * 원본 바이트를 들고 있는 결과 타입(Blob·File)은 원본 타입으로 오버라이드한다.
   */
  protected defaultBlobMimeType(): string {
    return 'image/png';
  }

  /**
   * `toDataURL()`이 format 미지정일 때 쓸 기본 MIME이다.
   *
   * `defaultBlobMimeType()`과 분리돼 있다 — Blob·File 결과의 `toDataURL()`은
   * 원본 타입이 아니라 `image/png`를 쓴다. 기존 동작을 그대로 유지하기 위한
   * 분리이며, 두 훅의 통일 여부는 별도 판단 대상이다.
   */
  protected defaultDataURLMimeType(): string {
    return 'image/png';
  }

  /** Data URL로 변환한다. */
  async toDataURL(options?: OutputOptions): Promise<string> {
    const canvas = await this.renderCanvas();
    return canvasToDataURL(canvas, options, this.defaultDataURLMimeType());
  }

  /** Blob으로 변환한다. */
  async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    const canvas = await this.renderCanvas();
    return canvasToBlob(canvas, options, this.defaultBlobMimeType());
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

/**
 * 원본 바이트(Blob 또는 File)를 들고 있는 결과 객체의 공통 base다.
 *
 * @description `File`은 `Blob`의 서브클래스이므로 두 결과 타입의 변환 경로가
 *   완전히 같다 — object URL을 만들어 이미지로 로드한 뒤 canvas에 그린다.
 *   옵션이 없으면 재인코딩 없이 보유 중인 바이트를 그대로 돌려준다.
 */
export abstract class BlobBackedResult extends ResultBase {
  /** 이 결과가 보유한 원본 바이트다. */
  protected abstract get payload(): globalThis.Blob;

  /** 원본 바이트의 MIME을 재인코딩 기본값으로 쓴다. */
  protected override defaultBlobMimeType(): string {
    return this.payload.type;
  }

  /** Canvas로 변환한다. 이미 알고 있는 결과 크기를 그대로 쓴다. */
  async toCanvas(): Promise<HTMLCanvasElement> {
    return withObjectUrl(this.payload, async (objectUrl) => {
      const img = await loadImageFromUrl(objectUrl);
      // 결과를 호출자에게 넘기므로 owned canvas
      return drawToOwnedCanvas(img, this.width, this.height);
    });
  }

  /** HTMLImageElement로 변환한다. */
  async toElement(): Promise<HTMLImageElement> {
    return withObjectUrl(this.payload, (objectUrl) => loadImageFromUrl(objectUrl));
  }

  /** 옵션이 없으면 보유 중인 바이트를 그대로 반환한다(재인코딩 없음). */
  override async toBlob(options?: OutputOptions): Promise<globalThis.Blob> {
    if (!options) {
      return this.payload;
    }

    return super.toBlob(options);
  }

  /** 호출자 소유 canvas를 만드는 경로가 곧 재인코딩 소스다. */
  protected async renderCanvas(): Promise<HTMLCanvasElement> {
    return this.toCanvas();
  }
}
