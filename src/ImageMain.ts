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
    urlToFile,
    urlToBuffer,
    urlToDataUrl,
    urlToElement,
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
        return ImageBlobs.toElement(source);
    }

    if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:")) {
        return urlToElement(source, opts);
    }

    if (source.includes("<svg ")) {
        return ImageSvgs.toElement(source, opts);
    }

    // 상대경로 등이 있을 수 있다.
    // ex) myimg/xxx
    // /myimg/xxx
    // ./myimg/xxx
    return urlToElement(source, opts);

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
    urlToFile,
    urlToBuffer,
    urlToDataUrl,
    urlToElement,
};

export class ImageMain {
    svg = ImageSvgs;
    element = ImageElements;
    dataUrl = ImageDataUrls;
    buffer = ImageBuffers;
    blob = ImageBlobs;
    util = imageUtil;

    toElement = (
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

    async download(source: HTMLImageElement | Blob | string, fileName: string): Promise<void> {
        if (source instanceof Blob) {
            downloadBlob(source, fileName);
            return;
        }
        if (source instanceof HTMLImageElement) {
            urlToBlob(source.src).then((blob) => downloadBlob(blob, fixBlobFileExt(blob, fileName)));
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
