import { urlToElement, downloadBlob, blobToDataUrl } from "./base/image-common";

export class ImageBlobs {
    static toDataURL = (blob: Blob): Promise<string> => {
        return blobToDataUrl(blob);
    };

    static toElement(blob: Blob): Promise<HTMLImageElement> {
        return blobToDataUrl(blob).then(urlToElement);
    }

    static downloadFile(file: File) {
        downloadBlob(file, file.name);
    }

    static download(blob: Blob, fileName: string) {
        downloadBlob(blob, fileName);
    }
}
