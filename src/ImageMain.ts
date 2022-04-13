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
import { ImageSimpleResizer } from "./ImageSimpleResizer";
import { ImageSvgs } from "./ImageSvgs";

async function convertImageSourceToElement(
    source: HTMLImageElement | Blob | string,
    opts?: {
        crossOrigin?: string;
        elementSize?: { width: number; height: number };
    }
): Promise<HTMLImageElement> {
    if (source instanceof Blob) {
        return ImageBlobs.toElement(source);
    } else if (typeof source === "string") {
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
    } else {
        return source;
    }

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
    simpleResizer = ImageSimpleResizer;

    toElement = (
        source: HTMLImageElement | Blob | string,
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

        if (source.includes("<svg")) {
            const blob = new Blob([source], { type: "svg" });
            downloadBlob(blob, fixBlobFileExt(blob, fileName));
            return;
        }

        // if (source.startsWith("http://") || source.startsWith("https://")) {
        //     downloadLink(source);
        //     return;
        // }
        // source https:// or http://
        // /some/path or ./some/path or some/path
        if (typeof source === "string") {
            // downloadLink(source);
            let blob = await urlToBlob(source);
            downloadBlob(blob, fixBlobFileExt(blob, fileName));
            return;
        }

        throw new Error("unknown source");
    }
}
