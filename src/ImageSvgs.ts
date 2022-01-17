import { urlToImageElement, downloadBlob, svgToDataUrl } from "./base/image-common";

export class ImageSvgs {
    static toDataUrl = (svgXml: string): Promise<string> => {
        return svgToDataUrl(svgXml);
    };

    static toImageElement(
        svgXml: string,
        opts?: {
            crossOrigin?: string;
            elementSize?: { width: number; height: number };
        }
    ): Promise<HTMLImageElement> {
        return svgToDataUrl(svgXml).then((dataUrl) => urlToImageElement(dataUrl, opts));
    }

    static download = (svgXml: string, fileName: string) => {
        const imageAsData = [svgXml];
        const blob = new Blob(imageAsData, { type: "svg" });
        downloadBlob(blob, fileName);
    };
}
