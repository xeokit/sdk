export interface Texture {
    textureId: string;
    imageData: any;
    src: any;
    buffers?: number[];
    mediaType: number;
    minFilter: number;
    magFilter: number;
    wrapS: number;
    wrapT: number;
    wrapR: number;
}