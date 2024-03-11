import {
    BlobWithSize,
    CenterCropOptions,
    CenterInsideOptions,
    DataUrlWithSize,
    FillOptions,
    FitOptions,
    ImageScaleType,
} from "./base/common-types";

import { blobToDataUrl, blobToFile, svgToDataUrl, urlToElement } from "./base/image-common";
import {
    CanvasConvertFn,
    canvasToBlob,
    canvasToDataUrl,
    toCenterCrop,
    toCenterInside,
    toFill,
    toFit,
} from "./base/image-resizes";

type ResizeSourceType = HTMLImageElement | string | Blob;
type ResizeFormatType = "png" | "jpeg";

const sourceToElement = async (
    source: ResizeSourceType,
    opts: {
        crossOrigin?: string;
    }
): Promise<HTMLImageElement> => {
    if (typeof source === "string") {
        if (source.includes("<svg ")) {
            return urlToElement(svgToDataUrl(source), opts);
        } else {
            return urlToElement(source, opts);
        }
    } else if (source instanceof Blob) {
        return blobToDataUrl(source).then((dataUrl) => urlToElement(dataUrl, opts));
    }

    return source;
};

export class ImageResizer {
    private centerInsideOptions?: CenterInsideOptions;
    private centerCropOptions?: CenterCropOptions;
    private fillOptions?: FillOptions;
    private fitOptions?: FitOptions;

    constructor(private source: ResizeSourceType) {
        // empty
    }

    static from(source: ResizeSourceType) {
        return new ImageResizer(source);
    }

    centerCrop = (opts: CenterCropOptions) => {
        this.centerCropOptions = opts;
        return this;
    };

    centerInside = (opts: CenterInsideOptions) => {
        this.centerInsideOptions = opts;
        return this;
    };

    fit = (opts: FitOptions) => {
        this.fitOptions = opts;
        return this;
    };

    scale = (scale: ImageScaleType) => {
        this.fillOptions = {
            scale,
            quality: 1,
        };
        return this;
    };

    fill = (opts: FillOptions) => {
        this.fillOptions = opts;
        return this;
    };

    toFile = (format: ResizeFormatType, fileName: string) => {
        return this.toBlob(format).then((blob) => {
            return blobToFile(blob, fileName);
        });
    };

    toBlob = async (format: ResizeFormatType): Promise<Blob> => {
        let img = await sourceToElement(this.source, {
            crossOrigin: "Anonymous",
        });
        const { blob } = await this._toBlob(img, format);
        return blob;
    };

    toElement = (format: ResizeFormatType): Promise<HTMLImageElement> => {
        return this.toDataUrl(format).then(urlToElement);
    };

    toDataUrl = async (format: ResizeFormatType): Promise<string> => {
        let img = await sourceToElement(this.source, {
            crossOrigin: "Anonymous",
        });
        const { dataUrl } = await this._toDataUrl(img, format);
        return dataUrl;
    };

    private _setupCanvas = (
        step: "preSetup" | "preDraw" | "postDraw",
        ctx: CanvasRenderingContext2D,
        scale: ImageScaleType
    ) => {
        // if (typeof scale === "undefined" || scale === null) return;
        // const { scaleX, scaleY } = getScale(scale);
        // ctx.scale(scaleX, scaleY);
    };

    private _toDataUrl = (img: HTMLImageElement, format: ResizeFormatType): Promise<DataUrlWithSize> => {
        return this._to(img, format, canvasToDataUrl);
    };

    private _toBlob = (img: HTMLImageElement, format: ResizeFormatType): Promise<BlobWithSize> => {
        return this._to(img, format, canvasToBlob);
    };

    private _to = <T>(img: HTMLImageElement, format: ResizeFormatType, convertFn: CanvasConvertFn<T>): Promise<T> => {
        if (this.centerInsideOptions != null) {
            const opts = this.centerInsideOptions;

            return toCenterInside(
                img,
                format === "png",
                {
                    size: opts.size,
                    quality: opts.quality,
                    backgroundColor: opts.backgroundColor,
                    padding: opts.padding,
                    trim: opts.trim,
                },
                convertFn,
                (step, canvas, ctx) => {
                    // this._setupCanvas(step, ctx, opts.scale);
                }
            );
        }
        if (this.centerCropOptions != null) {
            const opts = this.centerCropOptions;
            return toCenterCrop(
                img,
                format === "png",
                {
                    size: opts.size,
                    quality: opts.quality,
                    backgroundColor: opts.backgroundColor,
                    padding: opts.padding,
                    scale: opts.scale,
                },
                convertFn,
                (step, canvas, ctx) => {
                    // this._setupCanvas(step, ctx, opts.scale)
                }
            );
        }

        if (this.fillOptions != null) {
            const opts = this.fillOptions;
            return toFill(
                img,
                format === "png",
                {
                    size: opts.size,
                    scale: opts.scale,
                    quality: opts.quality,
                    backgroundColor: opts.backgroundColor,
                    padding: opts.padding,
                },
                convertFn,
                (step, canvas, ctx) => {
                    // this._setupCanvas(step, ctx, opts.scale)
                }
            );
        }

        if (this.fitOptions != null) {
            const opts = this.fitOptions;
            return toFit(
                img,
                format === "png",
                {
                    size: opts.size,
                    scale: opts.scale,
                    quality: opts.quality,
                    backgroundColor: opts.backgroundColor,
                    padding: opts.padding,
                },
                convertFn,
                (step, canvas, ctx) => {
                    // this._setupCanvas(step, ctx, opts.scale)
                }
            );
        }

        throw new Error("resize option is not valid");
    };
}
