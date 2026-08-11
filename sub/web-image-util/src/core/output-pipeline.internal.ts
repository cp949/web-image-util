/**
 * 출력 파이프라인 — processImage() 출력 경로 전체를 담당하는 deep module이다.
 *
 * @description ImageProcessor가 축적한 연산(resize/blur)을 받아, 출력 시점에
 * 소스 정규화 → LazyRenderPipeline 구성 → pending 재생 → 렌더 → 포맷/품질 기본값
 * → 인코딩 → pool 반환 → Result 래핑을 한 곳에서 수행한다.
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
import { validateResizeConfig } from '../types/resize-config';
import {
  BlobResultImpl,
  CanvasResultImpl,
  DataURLResultImpl,
  FileResultImpl,
} from '../types/result-implementations.internal';
import type { ResizeOperation } from '../types/shortcut-types';
import { detectCanvasFormatSupport } from '../utils/browser-capabilities/index';
import { formatToMimeType, mimeTypeToOutputFormat } from '../utils/format-utils';
import { createImageElement } from '../utils/image-element.internal';
import { LazyRenderPipeline } from './lazy-render-pipeline.internal';
import { convertToImageElement } from './source-converter/index';
import type { SvgPassthroughMode } from './source-converter/options.internal';

// 공개 ProcessorOptions를 확장하는 내부 전용 옵션 타입이다.
// processor.ts가 재사용하되, index.ts에서 re-export하지 않는다.
export type InternalProcessorOptions = ProcessorOptions & {
  __svgPassthroughMode?: SvgPassthroughMode;
};

/** `resize()` 중복 호출 시 사용하는 에러 메시지다. */
const MULTIPLE_RESIZE_RESIZE_MESSAGE =
  'resize() can only be called once. Use a single resize() call to prevent image quality degradation.';

/** Shortcut API의 resize operation 중복 추가 시 사용하는 에러 메시지다. */
const MULTIPLE_RESIZE_OPERATION_MESSAGE =
  'resize() can only be called once. Use a single resize operation to prevent image quality degradation.';

/** 준비 단계(소스 정규화 + 파이프라인 구성) 결과다. */
interface PreparedPipeline {
  lazyPipeline: LazyRenderPipeline;
  sourceImage: HTMLImageElement;
}

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
 * 소스 로딩과 파이프라인 구성은 첫 출력 호출에서 정확히 1회 일어나고 이후 캐시된다.
 */
export class OutputPipeline {
  private readonly source: ImageSource;
  private readonly options: InternalProcessorOptions;

  // resize 1회 제약의 런타임 상태. 컴파일 타임 전이(AfterResizeCall)는 ImageProcessor가 유지한다.
  private hasResized = false;

  // 준비 전 축적 연산. 재생 순서는 resize config → resize operation → blur(호출 순서)로 고정이다.
  private pendingResizeConfig: ResizeConfig | null = null;
  private pendingResizeOperation: ResizeOperation | null = null;
  private pendingBlurOptions: BlurOptions[] = [];

  // 준비 promise 메모이즈 — 동시 첫 출력에서도 소스 로딩·구성은 1회만 일어난다(single-flight).
  private prepared: Promise<PreparedPipeline> | null = null;

  // 준비 완료 후에만 세팅된다. addResizeOperation의 즉시 반영 분기가 이 필드를 본다.
  private livePipeline: LazyRenderPipeline | null = null;

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
   * resize 설정을 축적한다. 1회 제약 검사 → 런타임 검증 → 기록 순서이며,
   * 검증 실패 시 어떤 상태도 남기지 않는다.
   *
   * 주의(현행 동작 보존): 첫 출력 이후의 호출은 이후 출력에 반영되지 않는다.
   * 파이프라인 구성이 이미 끝났고 재구성하지 않기 때문이다. 반영 통일은 공개
   * 동작 변경이므로 이 모듈의 범위 밖이다.
   */
  addResize(config: ResizeConfig): void {
    this.assertResizeNotCalled(MULTIPLE_RESIZE_RESIZE_MESSAGE);
    validateResizeConfig(config);
    this.hasResized = true;
    this.pendingResizeConfig = config;
  }

  /**
   * Shortcut API의 resize operation을 축적한다.
   * 준비 전이면 pending에 저장하고, 준비 후면 라이브 파이프라인에 즉시 반영한다.
   */
  addResizeOperation(operation: ResizeOperation): void {
    this.assertResizeNotCalled(MULTIPLE_RESIZE_OPERATION_MESSAGE);
    this.hasResized = true;

    if (this.livePipeline) {
      this.livePipeline._addResizeOperation(operation);
    } else {
      this.pendingResizeOperation = operation;
    }
  }

  /**
   * blur 옵션을 축적한다. 여러 번 호출 가능하며 호출 순서를 보존한다.
   *
   * 주의(현행 동작 보존): 첫 출력 이후의 호출은 배열에 축적은 되지만
   * prepare가 재실행되지 않으므로 이후 출력에 재생되지 않는다.
   */
  addBlur(radius: number, options: Partial<BlurOptions> = {}): void {
    this.pendingBlurOptions = [...this.pendingBlurOptions, { radius, ...options }];
  }

  private assertResizeNotCalled(message: string): void {
    if (this.hasResized) {
      throw new ImageProcessError(message, 'MULTIPLE_RESIZE_NOT_ALLOWED');
    }
  }

  // ==============================================
  // 준비와 렌더
  // ==============================================

  /** 소스 정규화와 파이프라인 구성을 1회만 수행한다(promise 메모이즈). */
  private ensurePrepared(): Promise<PreparedPipeline> {
    if (!this.prepared) {
      this.prepared = this.prepare().catch((error) => {
        // 실패는 캐시하지 않는다 — 다음 출력이 소스 로딩부터 재시도한다.
        // pending 필드는 prepare 성공 시에만 비워지므로 재시도 시 그대로 재생된다.
        this.prepared = null;
        throw error;
      });
    }
    return this.prepared;
  }

  private async prepare(): Promise<PreparedPipeline> {
    // 입력 소스를 공통 이미지 요소로 바꾼다.
    const sourceImage = await convertToImageElement(this.source, this.options);

    // 이후 연산을 쌓아 둘 지연 파이프라인을 만든다.
    const lazyPipeline = new LazyRenderPipeline(sourceImage);

    // 준비 전에 축적된 연산을 정해진 순서(resize config → resize operation → blur)로 재생한다.
    if (this.pendingResizeConfig) {
      lazyPipeline.addResize(this.pendingResizeConfig);
    }
    if (this.pendingResizeOperation) {
      lazyPipeline._addResizeOperation(this.pendingResizeOperation);
    }
    for (const blurOption of this.pendingBlurOptions) {
      lazyPipeline.addBlur(blurOption);
    }

    this.pendingResizeConfig = null;
    this.pendingResizeOperation = null;
    this.pendingBlurOptions = [];

    this.livePipeline = lazyPipeline;
    return { lazyPipeline, sourceImage };
  }

  /**
   * 준비를 보장한 뒤 렌더를 정확히 1회 수행한다.
   * 실제 Canvas 작업은 여기서 호출하는 LazyRenderPipeline.render()가 전부다.
   */
  private async renderOnce(): Promise<ProcessingOutcome> {
    try {
      const { lazyPipeline, sourceImage } = await this.ensurePrepared();
      const { lease, metadata } = lazyPipeline.render();

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
   * - 포맷이 정해지면 파일명 확장자도 그에 맞춰 정규화한다.
   */
  private resolveFileOutput(
    filename: string,
    optionsOrFormat: OutputOptions | OutputFormat
  ): { finalOptions: OutputOptions; resolvedFilename: string } {
    const formatFromFilename = getFormatFromFilename(filename);

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

    const resolvedFilename = finalOptions.format
      ? applyFormatExtensionToFilename(filename, finalOptions.format)
      : filename;

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

/** 브라우저 지원에 따라 기본 출력 포맷을 고른다. WebP 지원 시 WebP, 아니면 PNG. */
function getBestFormat(): OutputFormat {
  if (detectCanvasFormatSupport('webp')) {
    return 'webp';
  }
  return 'png';
}

/** 파일명에서 출력 포맷을 추출한다. 지원하지 않는 확장자는 null을 반환한다. */
function getFormatFromFilename(filename: string): OutputFormat | null {
  const ext = filename.toLowerCase().split('.').pop();

  const formatMap: Record<string, OutputFormat> = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    png: 'png',
    webp: 'webp',
    avif: 'avif',
  };

  return formatMap[ext || ''] || null;
}

/** 출력 포맷의 권장 파일 확장자(소문자)를 반환한다. JPEG 계열은 `.jpg`로 통일한다. */
function getCanonicalExtension(format: OutputFormat): string {
  if (format === 'jpeg' || format === 'jpg') return 'jpg';
  return format;
}

/**
 * 명시된 출력 포맷에 맞춰 파일명 확장자를 정규화한다.
 *
 * - 기존 확장자가 같은 포맷을 나타내면(`photo.jpg` + `jpeg`) 그대로 유지한다.
 * - 알려진 이미지 확장자가 있으면 포맷에 맞는 확장자로 교체한다.
 * - 그 외에는 권장 확장자를 덧붙인다.
 */
function applyFormatExtensionToFilename(filename: string, format: OutputFormat): string {
  const currentFormat = getFormatFromFilename(filename);
  const normalizedFormat: OutputFormat = format === 'jpg' ? 'jpeg' : format;
  if (currentFormat === normalizedFormat) {
    return filename;
  }

  const canonicalExt = getCanonicalExtension(format);
  const imageExtensionPattern = /\.(jpg|jpeg|png|webp|avif|gif|svg|bmp|ico|tiff?)$/i;
  if (imageExtensionPattern.test(filename)) {
    return filename.replace(imageExtensionPattern, `.${canonicalExt}`);
  }

  return `${filename}.${canonicalExt}`;
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
  return new Promise((resolve, reject) => {
    let objectUrl: string;
    try {
      objectUrl = URL.createObjectURL(blob);
    } catch (error) {
      reject(new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error }));
      return;
    }
    const img = createImageElement();
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(objectUrl);
    };
    img.onload = () => {
      try {
        cleanup();
        resolve(img);
      } catch (error) {
        reject(new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error }));
      }
    };
    img.onerror = () => {
      try {
        cleanup();
        reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
      } catch (error) {
        reject(new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error }));
      }
    };
    img.src = objectUrl;
  });
}
