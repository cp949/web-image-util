/**
 * image source
 *
 * source of string type is
 * svg xml
 * dataUrl
 * httpUrl
 * path
 *
 */
export type ImageSource = Blob | string;

export type ImagePaddingType =
    | number
    | {
          top: number;
          left: number;
          bottom: number;
          right: number;
      };

export type ImageScaleType =
    | number
    | {
          scaleX: number;
          scaleY: number;
      };

export type ImageSizeType =
    | number
    | {
          width: number;
          height: number;
      };

type BaseImageResizeOptions = {
    crossOrigin?: string;
    quality?: number; // 0~1
    scale?: ImageScaleType;
    backgroundColor?: string;
    padding?: ImagePaddingType;
    size?: ImageSizeType;
};

export type CenterCropOptions = BaseImageResizeOptions & {};

export type CenterInsideOptions = BaseImageResizeOptions & {
    /**
     * centerInside인 경우, size 파라미터가 전달되면, 여백이 생긴다.
     * 이미지에 여백을 포함할지 여부를 의미한다.
     */
    trim?: boolean;
};

export type FillOptions = BaseImageResizeOptions & {};
export type FitOptions = BaseImageResizeOptions & {};

export type ImageResizeOptions =
    | (CenterCropOptions & { scaleType: "centerCrop" })
    | (CenterInsideOptions & { scaleType: "centerInside" })
    | (FillOptions & { scaleType: "fill" })
    | (FitOptions & { scaleType: "fit" });

export type DataUrlWithSize = {
    dataUrl: string;
    width: number;
    height: number;
};

export type BlobWithSize = {
    blob: Blob;
    width: number;
    height: number;
};
