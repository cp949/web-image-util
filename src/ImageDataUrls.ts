import { urlToImageElement, dataUrlToBlob, dataUrlToBuffer, downloadBlob } from "./base/image-common";

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
        return dataUrlToBuffer(dataUrl);
    };

    static toBlob = (dataUrl: string): Promise<Blob> => {
        return dataUrlToBlob(dataUrl);
    };

    static toFile = (dataUrl: string, fileName: string): Promise<File> => {
        return dataUrlToBlob(dataUrl).then((blob) => {
            // console.log("dataUrlToBlob = ", blob.type, blob);
            if (blob.type.indexOf("image/svg+xml") >= 0) {
                return new File([blob], fileName, { type: "svg" });
            } else {
                return new File([blob], fileName, { type: blob.type });
            }
        });
    };

    static toImageElement = (
        dataUrl: string,
        opts?: {
            crossOrigin?: string;
            elementSize?: { width: number; height: number };
        }
    ): Promise<HTMLImageElement> => {
        return urlToImageElement(dataUrl, opts);
    };

    static download = (dataUrl: string, fileName: string) => {
        dataUrlToBlob(dataUrl).then((blob) => downloadBlob(blob, fileName));
    };
}
