import { BlobWithSize, ImageSizeType } from "..";
import { DataUrlWithSize, ImageScaleType, ImagePaddingType } from "./common-types";

export type CanvasConvertFn<T> = (canvas: HTMLCanvasElement, isPng: boolean, quality?: number) => Promise<T>;

type CanvasHookFn = (
    step: "preSetup" | "preDraw" | "postDraw",
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
) => void;

const EMPTY_SCALE = {
    scaleX: 1,
    scaleY: 1,
};

function getScale(scale?: ImageScaleType): {
    scaleX: number;
    scaleY: number;
} {
    if (typeof scale === "undefined") return EMPTY_SCALE;
    if (typeof scale === "number") {
        return {
            scaleX: scale,
            scaleY: scale,
        };
    }
    return scale;
}

function getSize(size?: ImageSizeType): {
    width: number;
    height: number;
} | null {
    if (typeof size === "undefined" || size === null) return null;
    if (typeof size === "number") {
        return {
            width: size,
            height: size,
        };
    }
    return size;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, isPng: boolean, quality: number): Promise<DataUrlWithSize> {
    return new Promise((resolve) => {
        const dataUrl = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality);
        resolve({
            dataUrl,
            width: canvas.width,
            height: canvas.height,
        });
    });
}

export function canvasToBlob(canvas: HTMLCanvasElement, isPng: boolean, quality: number): Promise<BlobWithSize> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                resolve({
                    blob,
                    width: canvas.width,
                    height: canvas.height,
                });
            },
            isPng ? "image/png" : "image/jpeg",
            quality
        );
    });
}

function fixFloat(v: number) {
    return Math.round(v * 10000) / 10000;
}

/**
 * 이미지를 box안에 crop했을때
 * 원본 이미지에서 크롭될 영역을 계산해서 리턴한다
 * canvas.ctx.drawImage()에서 사용하기 위해 만들었다.
 *
 * 만약, 크롭된 크기를 알려면 scale값을 곱하면 된다.
 * 보통 크롭된 크기는 box크기이므로 계산할 필요가 없을 것이다.
 * @example
 * const {orgW, scale} = centerCrop(300,300,1920,1080);
 * const scaledW = orgW * scale
 */
function centerCropBox(boxWidth: number, boxHeight: number, intrinsicWidth: number, intrinsicHeight: number) {
    const scale = Math.max(boxWidth / intrinsicWidth, boxHeight / intrinsicHeight);

    const croppedW = Math.ceil(fixFloat(boxWidth / scale));
    const croppedH = Math.ceil(fixFloat(boxHeight / scale));
    const x = Math.floor(fixFloat((intrinsicWidth - croppedW) / 2));
    const y = Math.floor(fixFloat((intrinsicHeight - croppedH) / 2));

    return {
        scale,
        orgX: x,
        orgY: y,
        orgW: croppedW,
        orgH: croppedH,
    };
}

function centerInsideBox(boxWidth: number, boxHeight: number, intrinsicWidth: number, intrinsicHeight: number) {
    let scale = 1;
    let scaledWidth = intrinsicWidth;
    let scaledHeight = intrinsicHeight;

    if (boxWidth < intrinsicWidth || boxHeight < intrinsicHeight) {
        scale = Math.min(boxWidth / intrinsicWidth, boxHeight / intrinsicHeight);
        scaledWidth = Math.ceil(fixFloat(intrinsicWidth * scale));
        scaledHeight = Math.ceil(fixFloat(intrinsicHeight * scale));
    }

    const x = Math.floor(fixFloat((boxWidth - scaledWidth) / 2));
    const y = Math.floor(fixFloat((boxHeight - scaledHeight) / 2));

    return {
        scaledX: x,
        scaledY: y,
        scaledW: scaledWidth,
        scaledH: scaledHeight,
        scale,
    };
}

function fitBox(boxWidth: number, boxHeight: number, intrinsicWidth: number, intrinsicHeight: number) {
    let scale = 1;
    let scaledWidth = intrinsicWidth;
    let scaledHeight = intrinsicHeight;

    if (
        intrinsicWidth > boxWidth ||
        intrinsicHeight > boxHeight ||
        (intrinsicWidth < boxWidth && intrinsicHeight < boxHeight)
    ) {
        scale = Math.min(boxWidth / intrinsicWidth, boxHeight / intrinsicHeight);
        scaledWidth = Math.ceil(fixFloat(intrinsicWidth * scale));
        scaledHeight = Math.ceil(fixFloat(intrinsicHeight * scale));
    }

    const x = Math.floor(fixFloat((boxWidth - scaledWidth) / 2));
    const y = Math.floor(fixFloat((boxHeight - scaledHeight) / 2));

    // TODO remove ScaledX,Y , 항상 0이다
    return {
        scaledX: x, //0
        scaledY: y, //0
        scaledW: scaledWidth,
        scaledH: scaledHeight,
        scale,
    };
}

const EMPTY_PADDING = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
};

function getPadding(padding: number | { top: number; bottom: number; left: number; right: number }): {
    top: number;
    left: number;
    bottom: number;
    right: number;
} {
    if (!padding) return EMPTY_PADDING;
    if (typeof padding === "number") {
        return {
            top: padding,
            left: padding,
            right: padding,
            bottom: padding,
        };
    }
    return padding;
}

export function imageToCanvasCenterCrop(
    img: HTMLImageElement,
    opts: {
        size?: ImageSizeType;
        scale?: ImageScaleType;
        backgroundColor?: string;
        padding?: number | { top: number; left: number; bottom: number; right: number };
    },
    canvasHookFn?: CanvasHookFn
): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const { backgroundColor, padding = 0 } = opts;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.log("cannot create canvas context-2d");
        throw new Error("cannot create canvas context-2d");
    }

    canvasHookFn?.("preSetup", canvas, ctx);
    // canvas size
    const p = getPadding(padding);
    let canvasSize: { width: number; height: number };
    const size = getSize(opts.size);
    if (size) {
        canvasSize = {
            width: size.width - p.left - p.right,
            height: size.height - p.top - p.bottom,
        };
    } else {
        // size를 지정하지 않은 경우에만 scale이 유효하다
        const { scaleX, scaleY } = getScale(opts.scale);
        canvasSize = {
            width: img.width * scaleX,
            height: img.height * scaleY,
        };
    }

    const { orgX, orgY, orgW, orgH } = centerCropBox(canvasSize.width, canvasSize.height, img.width, img.height);
    canvas.width = canvasSize.width + p.left + p.right;
    canvas.height = canvasSize.height + p.top + p.bottom;

    if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    canvasHookFn?.("preDraw", canvas, ctx);
    ctx.drawImage(img, orgX, orgY, orgW, orgH, p.left, p.top, canvasSize.width, canvasSize.height);
    canvasHookFn?.("postDraw", canvas, ctx);
    return [canvas, ctx];
}

export function imageToCanvasCenterInside(
    img: HTMLImageElement,
    opts: {
        size?: ImageSizeType;
        backgroundColor?: string;
        padding?: number | { top: number; left: number; bottom: number; right: number };
        trim?: boolean;
    },
    canvasHookFn?: CanvasHookFn
): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const { backgroundColor, padding = 0, trim = false } = opts;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.log("cannot create canvas context-2d");
        throw new Error("cannot create canvas context-2d");
    }

    canvasHookFn?.("preSetup", canvas, ctx);

    // canvas size
    const p = getPadding(padding);
    let canvasSize: { width: number; height: number };
    const size = getSize(opts.size);
    if (size) {
        canvasSize = {
            width: size.width - p.left - p.right,
            height: size.height - p.top - p.bottom,
        };
    } else {
        canvasSize = {
            width: img.width,
            height: img.height,
        };
    }

    const { scaledX, scaledY, scaledW, scaledH } = centerInsideBox(
        canvasSize.width,
        canvasSize.height,
        img.width,
        img.height
    );

    if (trim) {
        canvas.width = scaledW + p.left + p.right;
        canvas.height = scaledH + p.top + p.bottom;
        if (backgroundColor && backgroundColor !== "transparent") {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        canvasHookFn?.("preDraw", canvas, ctx);
        ctx.drawImage(img, 0, 0, img.width, img.height, p.left, p.top, scaledW, scaledH);
    } else {
        canvas.width = canvasSize.width + p.left + p.right;
        canvas.height = canvasSize.height + p.top + p.bottom;
        if (backgroundColor && backgroundColor !== "transparent") {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        canvasHookFn?.("preDraw", canvas, ctx);
        ctx.drawImage(img, 0, 0, img.width, img.height, scaledX + p.left, scaledY + p.top, scaledW, scaledH);
    }

    canvasHookFn?.("postDraw", canvas, ctx);
    return [canvas, ctx];
}

export function imageToCanvasFit(
    img: HTMLImageElement,
    opts: {
        size?: ImageSizeType;
        scale?: ImageScaleType;
        backgroundColor?: string;
        padding?: number | { top: number; left: number; bottom: number; right: number };
        trim?: boolean;
    },
    canvasHookFn?: CanvasHookFn
): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const { backgroundColor, padding = 0, trim = false } = opts;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.log("cannot create canvas context-2d");
        throw new Error("cannot create canvas context-2d");
    }

    canvasHookFn?.("preSetup", canvas, ctx);

    // canvas size
    const p = getPadding(padding);
    let canvasSize: { width: number; height: number };
    const size = getSize(opts.size);
    if (size) {
        canvasSize = {
            width: size.width - p.left - p.right,
            height: size.height - p.top - p.bottom,
        };
    } else {
        // size를 지정하지 않은 경우에만 scale이 유효하다
        const { scaleX, scaleY } = getScale(opts.scale);
        canvasSize = {
            width: img.width * scaleX,
            height: img.height * scaleY,
        };
    }

    const { scaledW, scaledH } = fitBox(canvasSize.width, canvasSize.height, img.width, img.height);

    canvas.width = scaledW + p.left + p.right;
    canvas.height = scaledH + p.top + p.bottom;
    if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    canvasHookFn?.("preDraw", canvas, ctx);
    ctx.drawImage(img, 0, 0, img.width, img.height, p.left, p.top, scaledW, scaledH);
    canvasHookFn?.("postDraw", canvas, ctx);

    return [canvas, ctx];
}

export function imageToCanvasFill(
    img: HTMLImageElement,
    opts: {
        size?: ImageSizeType;
        scale?: ImageScaleType;
        backgroundColor?: string;
        padding?: number | { top: number; left: number; bottom: number; right: number };
    },
    canvasHookFn?: CanvasHookFn
): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const { backgroundColor, padding = 0 } = opts;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.log("cannot create canvas context-2d");
        throw new Error("cannot create canvas context-2d");
    }

    canvasHookFn?.("preSetup", canvas, ctx);

    // canvas size
    const p = getPadding(padding);
    let canvasSize: { width: number; height: number };
    const size = getSize(opts.size);
    if (size) {
        canvasSize = {
            width: size.width - p.left - p.right,
            height: size.height - p.top - p.bottom,
        };
    } else {
        const { scaleX, scaleY } = getScale(opts.scale);
        canvasSize = {
            width: img.width * scaleX,
            height: img.height * scaleY,
        };
    }

    canvas.width = canvasSize.width + p.left + p.right;
    canvas.height = canvasSize.height + p.top + p.bottom;
    if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    canvasHookFn?.("preDraw", canvas, ctx);
    ctx.drawImage(img, 0, 0, img.width, img.height, p.left, p.top, canvasSize.width, canvasSize.height);
    canvasHookFn?.("postDraw", canvas, ctx);
    return [canvas, ctx];
}

export function toCenterCrop<T>(
    img: HTMLImageElement,
    isPng: boolean,
    opts: {
        size?: ImageSizeType;
        scale?: ImageScaleType;
        quality?: number; // 0~1
        backgroundColor?: string;
        padding?: ImagePaddingType;
    },
    callback: CanvasConvertFn<T>,
    canvasHookFn?: CanvasHookFn
): Promise<T> {
    const [canvas, ctx] = imageToCanvasCenterCrop(
        img,
        {
            size: opts.size,
            scale: opts.scale,
            backgroundColor: opts.backgroundColor,
            padding: opts.padding,
        },
        canvasHookFn
    );
    // canvasHookFn?.(canvas, ctx);
    return callback(canvas, isPng, opts.quality);
}

export function toCenterInside<T>(
    img: HTMLImageElement,
    isPng: boolean,
    opts: {
        size?: ImageSizeType;
        quality?: number; // 0~1
        backgroundColor?: string;
        padding?: ImagePaddingType;
        trim?: boolean;
    },
    callback: CanvasConvertFn<T>,
    canvasHookFn?: CanvasHookFn
): Promise<T> {
    const [canvas, ctx] = imageToCanvasCenterInside(
        img,
        {
            size: opts.size,
            backgroundColor: opts.backgroundColor,
            padding: opts.padding,
            trim: opts.trim,
        },
        canvasHookFn
    );
    // canvasHookFn?.(canvas, ctx);
    return callback(canvas, isPng, opts.quality);
}

export function toFit<T>(
    img: HTMLImageElement,
    isPng: boolean,
    opts: {
        size?: ImageSizeType;
        scale?: ImageScaleType;
        quality?: number; // 0~1
        backgroundColor?: string;
        padding?: ImagePaddingType;
        trim?: boolean;
    },
    callback: CanvasConvertFn<T>,
    canvasHookFn?: CanvasHookFn
): Promise<T> {
    const [canvas, ctx] = imageToCanvasFit(
        img,
        {
            size: opts.size,
            scale: opts.scale,
            backgroundColor: opts.backgroundColor,
            padding: opts.padding,
            trim: opts.trim,
        },
        canvasHookFn
    );
    // canvasHookFn?.(canvas, ctx);
    return callback(canvas, isPng, opts.quality);
}

export function toFill<T>(
    img: HTMLImageElement,
    isPng: boolean,
    opts: {
        size?: ImageSizeType;
        scale?: ImageScaleType;
        quality?: number; // 0~1
        backgroundColor?: string;
        padding?: ImagePaddingType;
    },
    callback: CanvasConvertFn<T>,
    canvasHookFn?: CanvasHookFn
): Promise<T> {
    const [canvas, ctx] = imageToCanvasFill(
        img,
        {
            size: opts.size,
            scale: opts.scale,
            backgroundColor: opts.backgroundColor,
            padding: opts.padding,
        },
        canvasHookFn
    );
    // canvasHookFn?.(canvas, ctx);
    return callback(canvas, isPng, opts.quality);
}
