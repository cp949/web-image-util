/**
 * 출력 파이프라인 — processImage() 출력 경로 전체를 담당하는 deep module이다.
 *
 * @description ImageProcessor가 위임한 연산(resize/blur)을 생성 시점부터 존재하는
 * LazyRenderPipeline에 직접 축적하고, 출력 시점에 소스 정규화 → 렌더 →
 * 포맷/품질 기본값 → 인코딩 → pool 반환 → Result 래핑을 한 곳에서 수행한다.
 *
 * 소유권 규칙: 인코딩 계열(toBlob과 그 파생)은 lease.consume()으로 canvas를
 * pool에 반환하고, toCanvas/toCanvasDetailed만 lease.detach()로 사용자에게
 * 소유권을 이전한다. CanvasLease는 이 모듈의 interface 밖으로 노출되지 않는다.
 *
 * 공개 export가 아니다 — src에서는 processor.ts만 사용한다.
 */

import type { CanvasLease } from '../base/canvas-lease.internal';
import { canvasToBlob } from '../base/canvas-utils.internal';
import type {
  BlurOptions,
  ImageFormat,
  ImageSource,
  OutputFormat,
  OutputOptions,
  ProcessorOptions,
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultFile,
} from '../types';
import { ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import {
  BlobResultImpl,
  CanvasResultImpl,
  DataURLResultImpl,
  FileResultImpl,
} from '../types/result-implementations.internal';
import { detectCanvasFormatSupport } from '../utils/browser-capabilities/index';
import {
  formatToMimeType,
  getOutputFilename,
  mimeTypeToOutputFormat,
  outputFormatFromFilename,
} from '../utils/format-utils';
import { decodeImageFromBlob } from '../utils/image-decode.internal';
import { LazyRenderPipeline } from './lazy-render-pipeline.internal';
import { convertToImageElement } from './source-converter/index';
import type { SvgPassthroughMode } from './source-converter/options.internal';

// 공개 ProcessorOptions를 확장하는 내부 전용 옵션 타입이다.
// processor.ts가 재사용하되, index.ts에서 re-export하지 않는다.
export type InternalProcessorOptions = ProcessorOptions & {
  __svgPassthroughMode?: SvgPassthroughMode;
};

/** 렌더 1회의 결과다. lease 소비 방식(consume/detach)은 출력 메서드가 결정한다. */
interface ProcessingOutcome {
  lease: CanvasLease;
  result: {
    width: number;
    height: number;
    processingTime: number;
    originalSize: { width: number; height: number };
  };
}

/**
 * 출력 경로 deep module. ImageProcessor 인스턴스당 정확히 1개 생성한다.
 *
 * 생성자는 옵션 기본값 병합만 수행하며 I/O·Canvas 작업이 없다(지연 렌더링 보존).
 * 소스 로딩은 첫 출력 호출에서 정확히 1회 일어나고 이후 캐시된다.
 * 연산 축적은 항상 같은 파이프라인으로 가므로 출력 전후의 반영 의미가 동일하다.
 */
export class OutputPipeline {
  private readonly source: ImageSource;
  private readonly options: InternalProcessorOptions;

  // 생성 직후부터 존재하는 연산 축적기다. resize 1회 불변식(가드·검증·메시지)은
  // 이 파이프라인이 단일 소유한다 — 여기서는 위임만 한다.
  private readonly pipeline = new LazyRenderPipeline();

  // 소스 변환 promise 메모이즈 — 동시 첫 출력에서도 소스 로딩은 1회만 일어난다(single-flight).
  private prepared: Promise<HTMLImageElement> | null = null;

  constructor(source: ImageSource, options: InternalProcessorOptions = {}) {
    this.source = source;
    this.options = {
      crossOrigin: 'anonymous',
      defaultQuality: 0.8,
      defaultBackground: { r: 0, g: 0, b: 0, alpha: 0 },
      __svgPassthroughMode: 'safe',
      ...options,
    };
  }

  // ==============================================
  // 축적 (동기, 렌더링 없음)
  // ==============================================

  /**
   * resize 설정을 파이프라인에 위임한다.
   * 1회 제약 가드와 런타임 검증은 LazyRenderPipeline.addResize가 수행한다.
   */
  addResize(config: ResizeConfig): void {
    this.pipeline.addResize(config);
  }

  /**
   * blur 옵션을 파이프라인에 위임한다. 여러 번 호출 가능하며 호출 순서를 보존한다.
   */
  addBlur(radius: number, options: Partial<BlurOptions> = {}): void {
    this.pipeline.addBlur({ radius, ...options });
  }

  // ==============================================
  // 준비와 렌더
  // ==============================================

  /** 소스 정규화를 1회만 수행한다(promise 메모이즈). */
  private ensurePrepared(): Promise<HTMLImageElement> {
    if (!this.prepared) {
      // 입력 소스를 공통 이미지 요소로 바꾼다.
      this.prepared = convertToImageElement(this.source, this.options).catch((error) => {
        // 실패는 캐시하지 않는다 — 다음 출력이 소스 로딩부터 재시도한다.
        // 연산은 파이프라인이 이미 보유하고 있으므로 재시도 시 그대로 사용된다.
        this.prepared = null;
        throw error;
      });
    }
    return this.prepared;
  }

  /**
   * 준비를 보장한 뒤 렌더를 정확히 1회 수행한다.
   * 실제 Canvas 작업은 여기서 호출하는 LazyRenderPipeline.render()가 전부다.
   */
  private async renderOnce(): Promise<ProcessingOutcome> {
    try {
      const sourceImage = await this.ensurePrepared();
      const { lease, metadata } = this.pipeline.render(sourceImage);

      return {
        lease,
        result: {
          width: metadata.width,
          height: metadata.height,
          processingTime: metadata.processingTime,
          originalSize: {
            width: sourceImage.naturalWidth || 0,
            height: sourceImage.naturalHeight || 0,
          },
        },
      };
    } catch (error) {
      if (error instanceof ImageProcessError) {
        throw error;
      }

      throw new ImageProcessError('Error occurred during image processing', 'CANVAS_CREATION_FAILED', { cause: error });
    }
  }

  // ==============================================
  // 출력 (공개 표면 1:1 미러)
  // ==============================================

  /** Blob으로 인코딩한다. 인코딩 후 canvas는 pool로 반환된다(실패 시에도 반환). */
  async toBlob(optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultBlob> {
    const outputOptions = this.resolveOutputOptions(optionsOrFormat);

    const { lease, result } = await this.renderOnce();

    try {
      // consume이 blob 변환 후 canvas를 pool로 반환한다 (실패 시에도 반환)
      const { blob, format } = await lease.consume((canvas) => encodeCanvasToBlob(canvas, outputOptions));

      return new BlobResultImpl(blob, result.width, result.height, result.processingTime, result.originalSize, format);
    } catch (error) {
      throw new ImageProcessError('Error occurred during Blob conversion', 'OUTPUT_FAILED', { cause: error });
    }
  }

  /** Data URL로 변환한다. */
  async toDataURL(optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultDataURL> {
    const blobResult = await this.toBlob(optionsOrFormat);

    try {
      const dataURL = await blobToDataURL(blobResult.blob);
      return new DataURLResultImpl(
        dataURL,
        blobResult.width,
        blobResult.height,
        blobResult.processingTime,
        blobResult.originalSize,
        blobResult.format
      );
    } catch (error) {
      throw new ImageProcessError('Error occurred during Data URL conversion', 'OUTPUT_FAILED', { cause: error });
    }
  }

  /** File 객체로 변환한다. 포맷 미지정 시 파일명 확장자에서 추론한다. */
  async toFile(filename: string, optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultFile> {
    const { finalOptions, resolvedFilename } = this.resolveFileOutput(filename, optionsOrFormat);
    const blobResult = await this.toBlob(finalOptions);

    try {
      const file = new File([blobResult.blob], resolvedFilename, {
        type: blobResult.blob.type,
        lastModified: Date.now(),
      });
      return new FileResultImpl(
        file,
        blobResult.width,
        blobResult.height,
        blobResult.processingTime,
        blobResult.originalSize,
        blobResult.format
      );
    } catch (error) {
      throw new ImageProcessError('Error occurred while creating File object', 'OUTPUT_FAILED', { cause: error });
    }
  }

  /** Canvas 소유권을 사용자에게 이전한다. 반환된 canvas는 pool로 돌아가지 않는다. */
  async toCanvas(): Promise<ResultCanvas> {
    return this.renderToCanvasResult('Error occurred during Canvas conversion');
  }

  /** toCanvas와 동작이 같다. 에러 메시지 문자열만 다르다(현행 보존). */
  async toCanvasDetailed(): Promise<ResultCanvas> {
    return this.renderToCanvasResult('Error occurred during detailed Canvas conversion');
  }

  private async renderToCanvasResult(errorMessage: string): Promise<ResultCanvas> {
    try {
      const { lease, result } = await this.renderOnce();
      return new CanvasResultImpl(
        lease.detach(), // 소유권을 사용자에게 이전 — pool로 돌아가지 않는다
        result.width,
        result.height,
        result.processingTime,
        result.originalSize,
        undefined // Canvas에는 포맷 정보가 없다.
      );
    } catch (error) {
      throw new ImageProcessError(errorMessage, 'OUTPUT_FAILED', { cause: error });
    }
  }

  /** HTMLImageElement를 생성한다. 경로: Canvas → Blob(png) → ObjectURL → Image */
  async toElement(): Promise<HTMLImageElement> {
    let blobResult: ResultBlob;
    try {
      blobResult = await this.toBlob('png');
    } catch (error) {
      throw new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error });
    }

    return blobToImageElement(blobResult.blob);
  }

  /** ArrayBuffer로 변환한다. 경로: Canvas → Blob(png) → ArrayBuffer */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    try {
      const blobResult = await this.toBlob('png');

      try {
        return await blobResult.blob.arrayBuffer();
      } catch (error) {
        throw new ImageProcessError('ArrayBuffer conversion failed', 'BLOB_TO_ARRAYBUFFER_FAILED', { cause: error });
      }
    } catch (error) {
      if (error instanceof ImageProcessError && error.code === 'BLOB_TO_ARRAYBUFFER_FAILED') {
        throw error;
      }

      throw new ImageProcessError('Error occurred during ArrayBuffer conversion', 'OUTPUT_FAILED', { cause: error });
    }
  }

  /** Uint8Array로 변환한다. */
  async toUint8Array(): Promise<Uint8Array> {
    try {
      const arrayBuffer = await this.toArrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new ImageProcessError('Error occurred during Uint8Array conversion', 'OUTPUT_FAILED', { cause: error });
    }
  }

  // ==============================================
  // 출력 옵션 해석
  // ==============================================

  /**
   * toBlob 인자를 Required<OutputOptions>로 정규화한다.
   *
   * - 문자열 포맷 → {format, quality: 최적 품질}
   * - 스마트 포맷(webp 지원 시 webp, 아니면 png)을 기본으로, fallbackFormat은 'png' 고정
   * - format만 지정하고 quality를 생략하면 그 포맷의 최적 품질을 적용한다.
   *   quality: 0은 유효한 값이므로 === undefined로 생략 여부를 판별한다.
   */
  private resolveOutputOptions(optionsOrFormat: OutputOptions | OutputFormat): Required<OutputOptions> {
    const options: OutputOptions =
      typeof optionsOrFormat === 'string'
        ? {
            format: optionsOrFormat,
            quality: this.getOptimalQuality(optionsOrFormat),
          }
        : optionsOrFormat;

    const smartFormat = getBestFormat();

    const outputOptions: Required<OutputOptions> = {
      format: smartFormat,
      quality: this.getOptimalQuality(smartFormat),
      fallbackFormat: 'png',
      ...options,
    };

    if (options.format && options.quality === undefined) {
      outputOptions.quality = this.getOptimalQuality(options.format);
    }

    return outputOptions;
  }

  /**
   * toFile 입력으로부터 최종 출력 옵션과 정규화된 파일명을 계산한다.
   *
   * - 문자열 인자는 포맷 지정으로 본다.
   * - 빈 옵션 객체이고 파일명에서 포맷을 추출할 수 있으면 그 포맷과 권장 품질을 쓴다.
   * - 포맷이 정해지면 파일명 확장자도 그에 맞춰 정규화한다(정책 정본은 `utils/format-utils`).
   */
  private resolveFileOutput(
    filename: string,
    optionsOrFormat: OutputOptions | OutputFormat
  ): { finalOptions: OutputOptions; resolvedFilename: string } {
    const formatFromFilename = outputFormatFromFilename(filename);

    let finalOptions: OutputOptions;
    if (typeof optionsOrFormat === 'string') {
      finalOptions = { format: optionsOrFormat };
    } else if (Object.keys(optionsOrFormat).length === 0 && formatFromFilename) {
      finalOptions = {
        format: formatFromFilename,
        quality: this.getOptimalQuality(formatFromFilename),
      };
    } else {
      finalOptions = optionsOrFormat;
    }

    const resolvedFilename = getOutputFilename(filename, { format: finalOptions.format });

    return { finalOptions, resolvedFilename };
  }

  /** 포맷별 권장 품질을 반환한다. gif/svg처럼 품질 개념이 없는 포맷은 defaultQuality를 쓴다. */
  private getOptimalQuality(format: ImageFormat): number {
    if (format === 'gif' || format === 'svg') {
      return this.options.defaultQuality ?? 0.8;
    }
    return OPTIMAL_QUALITY_BY_FORMAT[format as OutputFormat] ?? this.options.defaultQuality ?? 0.8;
  }
}

// ==============================================
// 포맷/파일명 순수 함수
// ==============================================

/**
 * 브라우저 지원에 따라 기본 출력 포맷을 고른다. WebP 지원 시 WebP, 아니면 PNG.
 *
 * @description 호출자가 format을 지정하지 않은 모든 출력에 적용되는 범용 기본값이라
 * 입력의 투명도 유무를 알 수 없다. 그래서 폴백은 알파를 보존하는 png다.
 * 썸네일 프리셋(presets/index.ts의 createThumbnail)은 사진 입력을 전제로 하므로
 * 같은 상황에서 jpeg로 떨어진다 — 의도된 차이다.
 * `/advanced` 서브엔트리의 `SmartFormatSelector.selectOptimalFormat()`(픽셀 샘플링 분석)도
 * 이 함수와 서로 무관하게 "최적 포맷"을 정의한다 — 이 두 곳(프리셋 폴백 제외) 다 의도적으로
 * 다른 무게의 판정이라 병합 대상은 아니다.
 */
function getBestFormat(): OutputFormat {
  if (detectCanvasFormatSupport('webp')) {
    return 'webp';
  }
  return 'png';
}

// ==============================================
// 인코딩·변환 순수 함수
// ==============================================

/**
 * Canvas를 Blob으로 인코딩한다.
 *
 * - 요청 포맷으로 변환 실패(blob === null) 시 fallbackFormat으로 재시도한다.
 * - 재시도도 실패하면 ImageProcessError('Canvas to Blob conversion failed', 'OUTPUT_FAILED')를 reject한다.
 * - 브라우저가 요청 포맷 대신 다른 MIME으로 반환할 수 있으므로 실제 type 기준으로 포맷을 결정한다.
 */
async function encodeCanvasToBlob(
  canvas: HTMLCanvasElement,
  options: Required<OutputOptions>
): Promise<{ blob: Blob; format: OutputFormat }> {
  const blob = await canvasToBlob(canvas, {
    mimeType: formatToMimeType(options.format),
    quality: options.quality,
    fallbackMimeType: formatToMimeType(options.fallbackFormat),
    errorCode: 'OUTPUT_FAILED',
  });

  return { blob, format: mimeTypeToOutputFormat(blob.type) ?? options.format };
}

/** Blob을 Data URL 문자열로 변환한다. */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert to Data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Blob을 로드된 HTMLImageElement로 변환한다.
 *
 * ObjectURL 생성 실패 시 OUTPUT_FAILED, 이미지 로딩 실패 시 IMAGE_LOAD_FAILED를 던진다.
 * Promise 결정 후 ObjectURL을 정리한다.
 */
function blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
  return decodeImageFromBlob(blob, {
    errorCode: 'IMAGE_LOAD_FAILED',
    objectUrlErrorCode: 'OUTPUT_FAILED',
    objectUrlMessage: 'Error occurred during Element conversion',
  });
}
