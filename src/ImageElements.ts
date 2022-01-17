import { urlToDataUrl } from "./base/image-common";

export class ImageElements {
    static toDataUrl = (img: HTMLImageElement): Promise<string> => {
        return urlToDataUrl(img.src);
    };
}
