import { ImageFileExt, ImageStringSourceType } from "./base/common-types";
import {
    checkImageFormatFromString,
    downloadBlob,
    imageFormatFromDataUrl,
    sourceTypeFromString,
    stringToBlob,
    stringToDataUrl,
    stringToElement,
    stringToFile,
} from "./base/image-common";

export class ImageStrings {
    static sourceType = (source: string): ImageStringSourceType | undefined => {
        return sourceTypeFromString(source);
    };

    static toBuffer = async (source: string): Promise<Uint8Array | undefined> => {
        return stringToBlob(source)
            .then((blob) => blob?.arrayBuffer())
            .then((b) => (b ? new Uint8Array(b) : undefined));
    };

    static toBlob = (source: string): Promise<Blob | undefined> => {
        return stringToBlob(source);
    };

    static toFile = (source: string, fileName: string): Promise<File | undefined> => {
        return stringToFile(source, fileName);
    };

    static toDataUrl = (source: string): Promise<string | undefined> => {
        return stringToDataUrl(source);
    };

    static toDataUrlWithFormat = (source: string): Promise<{ src: string; format: ImageFileExt } | undefined> => {
        return checkImageFormatFromString(source);
    };

    static formatOfDataUrl = (dataUrl: string): ImageFileExt | undefined => {
        return imageFormatFromDataUrl(dataUrl);
    };

    static toElement = (
        source: string,
        opts?: {
            crossOrigin?: string;
            elementSize?: { width: number; height: number };
        },
    ): Promise<HTMLImageElement | undefined> => {
        return stringToElement(source, opts);
    };

    static download = (source: string, fileName: string) => {
        stringToBlob(source).then((blob) => {
            if (blob) {
                downloadBlob(blob, fileName);
            }
        });
    };
}
