import { CenterCropOptions, CenterInsideOptions, DataUrlWithSize, FillOptions, FitOptions, ImageScaleType } from ".";
import { blobToDataUrl, blobToFile, urlToBlob, svgToDataUrl, urlToElement } from "./base/image-common";
import { toDataUrlCenterCrop, toDataUrlCenterInside, toDataUrlFill, toDataUrlFit } from "./base/image-resizes";

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
            return svgToDataUrl(source).then((dataUrl) => urlToElement(dataUrl, opts));
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

    fill = (opts: FillOptions) => {
        this.fillOptions = opts;
        return this;
    };

    toFile = (format: ResizeFormatType, fileName: string) => {
        return this.toDataUrl(format)
            .then(urlToBlob)
            .then((blob) => {
                return blobToFile(blob, fileName);
            });
    };

    toBlob = (format: ResizeFormatType): Promise<Blob> => {
        return this.toDataUrl(format).then(urlToBlob);
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

    private _setupCanvas = (step: "pre" | "post", ctx: CanvasRenderingContext2D, scale: ImageScaleType) => {
        // if (typeof scale === "undefined" || scale === null) return;
        // const { scaleX, scaleY } = getScale(scale);
        // ctx.scale(scaleX, scaleY);
    };

    private _toDataUrl = (img: HTMLImageElement, format: ResizeFormatType): Promise<DataUrlWithSize> => {
        return new Promise((resolve, reject) => {
            if (this.centerInsideOptions != null) {
                const opts = this.centerInsideOptions;
                resolve(
                    toDataUrlCenterInside(
                        img,
                        format === "png",
                        {
                            size: opts.size,
                            quality: opts.quality,
                            backgroundColor: opts.backgroundColor,
                            padding: opts.padding,
                            trim: opts.trim,
                        },
                        (step, canvas, ctx) => this._setupCanvas(step, ctx, opts.scale)
                    )
                );
                return;
            }

            if (this.centerCropOptions != null) {
                const opts = this.centerCropOptions;
                resolve(
                    toDataUrlCenterCrop(
                        img,
                        format === "png",
                        {
                            size: opts.size,
                            quality: opts.quality,
                            backgroundColor: opts.backgroundColor,
                            padding: opts.padding,
                            scale: opts.scale,
                        },
                        (step, canvas, ctx) => this._setupCanvas(step, ctx, opts.scale)
                    )
                );
                return;
            }

            if (this.fillOptions != null) {
                const opts = this.fillOptions;
                resolve(
                    toDataUrlFill(
                        img,
                        format === "png",
                        {
                            size: opts.size,
                            scale: opts.scale,
                            quality: opts.quality,
                            backgroundColor: opts.backgroundColor,
                            padding: opts.padding,
                        },
                        (step, canvas, ctx) => this._setupCanvas(step, ctx, opts.scale)
                    )
                );
                return;
            }

            if (this.fitOptions != null) {
                const opts = this.fitOptions;
                resolve(
                    toDataUrlFit(
                        img,
                        format === "png",
                        {
                            size: opts.size,
                            scale: opts.scale,
                            quality: opts.quality,
                            backgroundColor: opts.backgroundColor,
                            padding: opts.padding,
                        },
                        (step, canvas, ctx) => this._setupCanvas(step, ctx, opts.scale)
                    )
                );
                return;
            }

            reject(new Error("resize option is not valid"));
        });
    };
}
