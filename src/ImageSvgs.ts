import { urlToElement, downloadBlob, svgToDataUrl } from "./base/image-common";

export class ImageSvgs {
    static toDataUrl = (svgXml: string): Promise<string> => {
        return new Promise((resolve) => resolve(svgToDataUrl(svgXml)));
    };

    static toElement(
        svgXml: string,
        opts?: {
            crossOrigin?: string;
            elementSize?: { width: number; height: number };
        }
    ): Promise<HTMLImageElement> {
        return urlToElement(svgToDataUrl(svgXml), opts);
    }

    static download = (svgXml: string, fileName: string) => {
        const imageAsData = [svgXml];
        const blob = new Blob(imageAsData, { type: "svg" });
        downloadBlob(blob, fileName);
    };
}
