import { urlToElement } from "./base/image-common";
import { ImageBlobs } from "./ImageBlobs";
import { ImageResizer } from "./ImageResizer";
import { ImageSvgs } from "./ImageSvgs";

async function convertImageSourceToElement(
    source: HTMLImageElement | Blob | string,
    opts?: {
        crossOrigin?: string;
        elementSize?: { width: number; height: number };
    },
): Promise<HTMLImageElement> {
    if (source instanceof Blob) {
        return ImageBlobs.toElement(source);
    } else if (typeof source === "string") {
        if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:")) {
            return urlToElement(source, opts);
        }

        if (source.includes("<svg ")) {
            return ImageSvgs.toElement(source, opts);
        }

        // 상대경로 등이 있을 수 있다.
        // ex) myimg/xxx
        // /myimg/xxx
        // ./myimg/xxx
        return urlToElement(source, opts);
    } else {
        return source;
    }

    // console.log('unknown source', { source })
    // throw new Error('unknown source')
}

export class ImageSimpleResizer {
    /**
     * if source.width < width, 변경하지 않는다.
     * if source.width > width, source.width를 주어진 width에 맞춘다.
     */
    static async atMostWidth(
        source: HTMLImageElement | Blob | string,
        width: number,
        opts?: {
            crossOrigin?: string;
            quality?: number;
        },
    ): Promise<ImageResizer> {
        const element = await convertImageSourceToElement(source, { crossOrigin: opts?.crossOrigin });
        return ImageResizer.from(element).centerInside({
            size: {
                width,
                height: element.height, // 최대 높이
            },
            trim: true,
            crossOrigin: opts?.crossOrigin,
            quality: opts?.quality ?? 1,
        });
    }

    /**
     * if source.height < height, 변경하지 않는다.
     * if source.height > height, source.height=height로 축소한다.
     */
    static async atMostHeight(
        source: HTMLImageElement | Blob | string,
        height: number,
        opts?: {
            crossOrigin?: string;
            quality?: number;
        },
    ): Promise<ImageResizer> {
        const element = await convertImageSourceToElement(source, { crossOrigin: opts?.crossOrigin });
        return ImageResizer.from(element).centerInside({
            size: {
                width: element.width,
                height,
            },
            trim: true,
            crossOrigin: opts?.crossOrigin,
            quality: opts?.quality ?? 1,
        });
    }

    /**
     * if source.width < width, source.width=width로 확대한다.
     * if source.width > width, source.width=width로 축소한다.
     */
    static async forceWidth(
        source: HTMLImageElement | Blob | string,
        width: number,
        opts?: {
            crossOrigin?: string;
            quality?: number;
        },
    ): Promise<ImageResizer> {
        const element = await convertImageSourceToElement(source);

        if (element.width <= width) {
            // 원본비율을 유지하면서 확대
            const scale = width / element.width;
            const scaledHeight = element.height * scale;
            return ImageResizer.from(element).fill({
                size: {
                    width,
                    height: scaledHeight,
                },
                crossOrigin: opts?.crossOrigin,
                quality: opts?.quality ?? 1,
            });
        } else {
            // 원본비율을 유지하면서 축소한다
            return ImageResizer.from(element).fit({
                size: {
                    width,
                    height: element.height,
                },
                crossOrigin: opts?.crossOrigin,
                quality: opts?.quality ?? 1,
            });
        }
    }

    /**
     * if source.height < height, source.height=height로 확대한다.
     * if source.height > height, source.height=height로 축소한다.
     */
    static async forceHeight(
        source: HTMLImageElement | Blob | string,
        height: number,
        opts?: {
            crossOrigin?: string;
            quality?: number;
        },
    ): Promise<ImageResizer> {
        const element = await convertImageSourceToElement(source);
        if (element.height <= height) {
            const scale = height / element.height;
            const scaledWidth = element.width * scale;
            // 원본비율을 유지하면서 확대한다
            return ImageResizer.from(element).fill({
                size: {
                    width: scaledWidth,
                    height,
                },
                crossOrigin: opts?.crossOrigin,
                quality: opts?.quality ?? 1,
            });
        } else {
            // 원본비율을 유지하면서 축소한다
            return ImageResizer.from(element).fit({
                size: {
                    width: element.width,
                    height,
                },
                crossOrigin: opts?.crossOrigin,
                quality: opts?.quality ?? 1,
            });
        }
    }

    // 사각형 안에 넣습니다. 결과 이미지는 최대 widthxheight입니다
    // 원본의 aspect ratio는 유지합니다
    // 작은 이미지인 경우 확대하지 않습니다
    // 큰 이미지의 경우 축소
    // 원본이미지 짤림은 없습니다
    // 1000x100 을 500x500에 넣으면 결과 이미지는 500x50입니다
    // 100x100을 500x500에 넣으면 결과 이미지는 100x100입니다
    static async atMostRect(
        source: HTMLImageElement | Blob | string,
        size: {
            width: number;
            height: number;
        },
        opts?: {
            crossOrigin?: string;
            quality?: number;
        },
    ): Promise<ImageResizer> {
        return ImageResizer.from(source).centerInside({
            size,
            trim: true,
            crossOrigin: opts?.crossOrigin,
            quality: opts?.quality ?? 1,
        });
    }
}
