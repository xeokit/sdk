export declare const Canvas2Image: {
    saveAsBMP: () => void;
    saveAsPNG: () => void;
    saveAsJPEG: () => void;
} | {
    saveAsPNG: (oCanvas: HTMLCanvasElement, bReturnImg: boolean, iWidth: number, iHeight: number, flipy: boolean) => boolean | HTMLImageElement;
    saveAsJPEG: (oCanvas: HTMLCanvasElement, bReturnImg: boolean, iWidth: number, iHeight: number, flipy: boolean) => boolean | HTMLImageElement;
    saveAsBMP: (oCanvas: HTMLCanvasElement, bReturnImg: boolean, iWidth: number, iHeight: number, flipy: boolean) => boolean | HTMLImageElement;
};
