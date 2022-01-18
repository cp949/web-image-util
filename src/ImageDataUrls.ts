import { urlToElement, urlToBlob, urlToFile, urlToBuffer, downloadBlob } from "./base/image-common";

const PATTERN = /^data:((.*?)(;charset=.*?)?)(;base64)?,/;

// 브라우저에서 Buffer.from을 사용할 수 없다
// Uint8Array.from은 브라우저 호환성이 좋지 않아서 아직 사용 못한다
//
// if (base64) {
//   const buffer = Buffer.from(dataUrl.substring(firstCommaIdx + 1), "base64");
//   resolve({ type, buffer });
//   return;
// }
// const buffer = Buffer.from(data, "ascii");
// resolve({ type, buffer });

export class ImageDataUrls {
    static toBuffer = async (dataUrl: string): Promise<Uint8Array> => {
        return urlToBuffer(dataUrl);
    };

    static toBlob = (dataUrl: string): Promise<Blob> => {
        return urlToBlob(dataUrl);
    };

    static toFile = (dataUrl: string, fileName: string): Promise<File> => {
        return urlToFile(dataUrl, fileName);
    };

    static toElement = (
        dataUrl: string,
        opts?: {
            crossOrigin?: string;
            elementSize?: { width: number; height: number };
        }
    ): Promise<HTMLImageElement> => {
        return urlToElement(dataUrl, opts);
    };

    static download = (dataUrl: string, fileName: string) => {
        urlToBlob(dataUrl).then((blob) => downloadBlob(blob, fileName));
    };
}
