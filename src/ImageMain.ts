import { ImageSource } from "./base/common-types";
import {
    base64ToBuffer,
    blobToDataUrl,
    blobToFile,
    downloadBlob,
    downloadLink,
    fixBlobFileExt,
    isSvgDataUrl,
    svgToDataUrl,
    urlToBlob,
    urlToBuffer,
    urlToDataUrl,
    urlToImageElement,
} from "./base/image-common";
import { ImageBlobs } from "./ImageBlobs";
import { ImageBuffers } from "./ImageBuffers";
import { ImageDataUrls } from "./ImageDataUrls";
import { ImageElements } from "./ImageElements";
import { ImageResizer } from "./ImageResizer";
import { ImageSvgs } from "./ImageSvgs";

async function convertImageSourceToElement(
    source: ImageSource,
    opts?: {
        crossOrigin?: string;
        elementSize?: { width: number; height: number };
    }
): Promise<HTMLImageElement> {
    if (source instanceof Blob) {
        return ImageBlobs.toImageElement(source);
    }

    if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:")) {
        return urlToImageElement(source, opts);
    }

    if (source.includes("<svg ")) {
        return ImageSvgs.toImageElement(source, opts);
    }

    // 상대경로 등이 있을 수 있다.
    // ex) images/xxx
    // /images/xxx
    // ./images/xxx
    return urlToImageElement(source, opts);

    // console.log('unknown source', { source })
    // throw new Error('unknown source')
}

const imageUtil = {
    base64ToBuffer,
    blobToDataUrl,
    blobToFile,
    downloadBlob,
    downloadLink,
    fixBlobFileExt,
    isSvgDataUrl,
    svgToDataUrl,
    urlToBlob,
    urlToBuffer,
    urlToDataUrl,
    urlToImageElement,
};

export class ImageMain {
    svg = ImageSvgs;
    element = ImageElements;
    dataUrl = ImageDataUrls;
    buffer = ImageBuffers;
    blob = ImageBlobs;
    util = imageUtil;

    toImageElement = (
        source: ImageSource,
        opts?: {
            crossOrigin?: string;
            elementSize?: { width: number; height: number };
        }
    ): Promise<HTMLImageElement> => {
        return convertImageSourceToElement(source, opts);
    };

    resizeFrom(source: HTMLImageElement | Blob | string): ImageResizer {
        return ImageResizer.from(source);
    }

    async download(source: ImageSource, fileName: string): Promise<void> {
        if (source instanceof Blob) {
            downloadBlob(source, fileName);
            return;
        }

        if (source.startsWith("data:")) {
            const blob = await ImageDataUrls.toBlob(source);
            downloadBlob(blob, fixBlobFileExt(blob, fileName));
            return;
        }

        if (source.startsWith("http://") || source.startsWith("https://")) {
            downloadLink(source);
            return;
        }

        if (source.includes("<svg ")) {
            const blob = new Blob([source], { type: "svg" });
            downloadBlob(blob, fixBlobFileExt(blob, fileName));
            return;
        }

        throw new Error("unknown source");
    }
}
