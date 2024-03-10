// https://stackoverflow.com/questions/21797299/convert-base64-string-to-arraybuffer/62364519#62364519

import { ImageStringSourceType } from "./common-types";

// 데이터가 클때 이게 더 유리하다고
export function base64ToBuffer(base64: string): Promise<Uint8Array> {
    const dataUrl = "data:application/octet-binary;base64," + base64;

    return fetch(dataUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
}

export function downloadBlob(blob: Blob, fileName: string) {
    if ("download" in HTMLAnchorElement.prototype) {
        const downloadLink = document.createElement("a");
        downloadLink.setAttribute("crossorigin", "anonymous");
        document.body.appendChild(downloadLink);
        const url = window.URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = fileName;
        downloadLink.type = blob.type;
        downloadLink.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(downloadLink);
    } else {
        // iOS Safari, open a new page and set href to data-uri
        let popup: Window | null = window.open("", "_blank");
        if (popup) {
            const reader = new FileReader();
            reader.onloadend = function () {
                if (popup) {
                    popup.location.href = reader.result as string;
                    popup = null;
                }
            };
            reader.readAsDataURL(blob);
        } else {
            console.warn("window.open() fail");
        }
    }
}

export function downloadLink(href: string) {
    if ("download" in HTMLAnchorElement.prototype) {
        const downloadLink = document.createElement("a");
        document.body.appendChild(downloadLink);
        downloadLink.href = href;
        downloadLink.type = "application/octet-stream";
        downloadLink.click();
        document.body.removeChild(downloadLink);
    } else {
        // iOS Safari, open a new page and set href to data-uri
        const popup: Window | null = window.open("", "_blank");
        if (popup) {
            popup.location.href = href;
        } else {
            console.warn("window.open() fail");
        }
    }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            resolve(reader.result as string);
        });

        reader.addEventListener("error", (err: any) => {
            reject(err);
        });

        reader.readAsDataURL(blob);
    });
}

const fixFileExt = (fileName: string, ext: string) => {
    if (fileName.toLowerCase().endsWith("." + ext)) {
        return fileName;
    }
    const idx = fileName.lastIndexOf(".");
    if (idx > 0) {
        return fileName.substring(0, idx) + "." + ext;
    }
    return fileName + "." + ext;
};

export function fixBlobFileExt(blob: Blob, fileName: string) {
    const type = blob.type;
    if (type.includes("png")) {
        return fixFileExt(fileName, "png");
    } else if (type.includes("jpeg") || type.includes("jpg")) {
        return fixFileExt(fileName, "jpg");
    } else if (type.includes("svg") || type.includes("image/svg+xml")) {
        return fixFileExt(fileName, "svg");
    } else if (type.includes("webp")) {
        return fixFileExt(fileName, "webp");
    } else if (type.includes("image/tiff")) {
        return fixFileExt(fileName, "tiff");
    } else if (type.includes("image/bmp")) {
        return fixFileExt(fileName, "bmp");
    } else if (type.includes("image/vnd.microsoft.icon")) {
        return fixFileExt(fileName, "ico");
    } else if (type.includes("image/gif")) {
        return fixFileExt(fileName, "gif");
    }
    return fileName;
}

export function blobToFile(blob: Blob, fileName: string): Promise<File> {
    return new Promise((resolve, reject) => {
        if (blob.type.indexOf("image/svg+xml") >= 0) {
            return resolve(new File([blob], fixBlobFileExt(blob, fileName), { type: "image/svg+xml" }));
        } else {
            return resolve(new File([blob], fixBlobFileExt(blob, fileName), { type: blob.type }));
        }
    });
}

export async function urlToDataUrl(url: string): Promise<string> {
    if (url.startsWith("data:")) return url;
    return fetch(url)
        .then((res) => res.blob())
        .then(blobToDataUrl);
}

// support http and data url
export function urlToElement(
    url: string,
    opts?: {
        crossOrigin?: string;
        elementSize?: { width: number; height: number };
    }
): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        let img: HTMLImageElement;
        if (opts?.elementSize) {
            img = new Image(opts.elementSize.width, opts.elementSize.height);
        } else {
            img = new Image();
        }

        img.setAttribute("src", url);

        if (opts?.crossOrigin) {
            img.crossOrigin = opts?.crossOrigin;
        }

        img.onload = function () {
            resolve(img);
        };

        img.onerror = (err: any) => {
            reject(err);
        };
    });
}

export function urlToBuffer(dataUrl: string): Promise<Uint8Array> {
    return fetch(dataUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
}

export function urlToBlob(url: string): Promise<Blob> {
    return fetch(url).then((res) => res.blob());
}

export function urlToFile(url: string, fileName: string): Promise<File> {
    return fetch(url)
        .then((res) => res.blob())
        .then((blob) => {
            if (blob.type.indexOf("image/svg+xml") >= 0) {
                // return new File([blob], fixBlobFileExt(blob, fileName), { type: "svg" });
                return new File([blob], fixBlobFileExt(blob, fileName), { type: "image/svg+xml" });
            } else {
                return new File([blob], fixBlobFileExt(blob, fileName), { type: blob.type });
            }
        });
}

export function isSvgDataUrl(dataUrl: string): boolean {
    // "data:image/svg+xml;"
    return dataUrl.startsWith("data:image/svg+xml");
}

export function svgToDataUrl(svgXml: string): string {
    const svg = svgXml.replace(/&nbsp/g, "&#160");
    return "data:image/svg+xml," + encodeURIComponent(svg);
}

export function svgToBlob(svgXml: string): Blob {
    const svg = svgXml.replace(/&nbsp/g, "&#160");
    return new Blob([svg], { type: "image/svg+xml" });
}

export function sourceTypeFromString(str: string): ImageStringSourceType | undefined {
    if (str.startsWith("http://") || str.startsWith("https://")) return "HTTP_URL";
    if (str.startsWith("data:")) return "DATA_URL";
    if (str.indexOf("<svg") >= 0) return "SVG_XML";
    if (str.startsWith("/")) return "PATH";

    // undefined인 경우 path로 처리하면 된다
    return undefined;
}

export async function stringToDataUrl(str: string): Promise<string | undefined> {
    const sourceType = sourceTypeFromString(str);
    if (sourceType === "DATA_URL" || sourceType === "HTTP_URL") {
        return await urlToDataUrl(str);
    }
    if (sourceType === "SVG_XML") {
        return svgToDataUrl(str);
    }

    return await urlToDataUrl(str);
}

export async function stringToBlob(str: string): Promise<Blob | undefined> {
    const sourceType = sourceTypeFromString(str);
    if (sourceType === "DATA_URL" || sourceType === "HTTP_URL") {
        return await urlToBlob(str);
    }

    if (sourceType === "SVG_XML") {
        return svgToBlob(str);
    }

    return await urlToBlob(str);
}

export async function stringToFile(str: string, fileName: string): Promise<File> {
    return stringToBlob(str) //
        .then((blob) => new File([blob], fixBlobFileExt(blob, fileName), { type: blob.type }));
}

export async function stringToElement(
    str: string,
    opts?: {
        crossOrigin?: string;
        elementSize?: { width: number; height: number };
    }
): Promise<HTMLImageElement> {
    return stringToDataUrl(str).then((url) => urlToElement(url, opts));
}
