import { ImageStringSourceType } from "./base/common-types";
import { downloadBlob, sourceTypeFromString, stringToBlob, stringToElement, stringToFile } from "./base/image-common";

export class ImageStrings {
    static sourceType = (source: string): ImageStringSourceType | undefined => {
        return sourceTypeFromString(source);
    };

    static toBuffer = async (source: string): Promise<Uint8Array> => {
        return stringToBlob(source)
            .then((blob) => blob.arrayBuffer())
            .then((b) => new Uint8Array(b));
    };

    static toBlob = (source: string): Promise<Blob> => {
        return stringToBlob(source);
    };

    static toFile = (source: string, fileName: string): Promise<File> => {
        return stringToFile(source, fileName);
    };

    static toElement = (
        source: string,
        opts?: {
            crossOrigin?: string;
            elementSize?: { width: number; height: number };
        }
    ): Promise<HTMLImageElement> => {
        return stringToElement(source, opts);
    };

    static download = (source: string, fileName: string) => {
        stringToBlob(source).then((blob) => downloadBlob(blob, fileName));
    };
}
