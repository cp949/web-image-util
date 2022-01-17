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
    } else if (type.includes("svg")) {
        return fixFileExt(fileName, "svg");
    }
    return fileName;
}

export function blobToFile(blob: Blob, fileName: string): Promise<File> {
    return new Promise((resolve, reject) => {
        if (blob.type.indexOf("image/svg+xml") >= 0) {
            return resolve(new File([blob], fixBlobFileExt(blob, fileName), { type: "svg" }));
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
export function urlToImageElement(
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

// https://stackoverflow.com/questions/21797299/convert-base64-string-to-arraybuffer/62364519#62364519
// 데이터가 클때 이게 더 유리하다고
export function base64ToBuffer(base64: string): Promise<Uint8Array> {
    const dataUrl = "data:application/octet-binary;base64," + base64;

    return fetch(dataUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
}

export function dataUrlToBuffer(dataUrl: string): Promise<Uint8Array> {
    return fetch(dataUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
}

export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return fetch(dataUrl).then((res) => res.blob());
}

export function isSvgDataUrl(dataUrl: string): boolean {
    // "data:image/svg+xml;"
    return dataUrl.startsWith("data:image/svg+xml");
}

export function svgToDataUrl(svgXml: string): Promise<string> {
    return new Promise((resolve) => {
        svgXml = svgXml.replace(/&nbsp/g, "&#160");
        resolve("data:image/svg+xml;ascii," + encodeURIComponent(svgXml));
    });
}
