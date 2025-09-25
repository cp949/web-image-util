const _encode = (buffer: Uint8Array, type: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const blob = new Blob([buffer as BlobPart], { type });
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            resolve(reader.result as string);
        });

        reader.addEventListener("error", (err: any) => {
            reject(err);
        });

        reader.readAsDataURL(blob);
    });
};

export class ImageBuffers {
    static toPngDataURL = (buffer: Uint8Array): Promise<string> => {
        return _encode(buffer, "image/png");
    };

    static toJpegDataURL = (buffer: Uint8Array): Promise<string> => {
        return _encode(buffer, "image/jpeg");
    };
}
