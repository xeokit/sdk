/**
 * Canvas2Image v0.1
 * Copyright (c) 2008 Jacob Seidelin, cupboy@gmail.com
 * MIT License [http://www.opensource.org/licenses/mit-license.php]
 *
 * Modified by @xeolabs to permit vertical flipping, so that snapshot can be taken from WebGL frame buffers,
 * which vertically flip image data as part of the way that WebGL renders textures.
 */
export declare const Canvas2Image: {
    saveAsBMP: () => void;
    saveAsPNG: () => void;
    saveAsJPEG: () => void;
} | {
    saveAsPNG: (oCanvas: HTMLCanvasElement, bReturnImg: boolean, iWidth: number, iHeight: number, flipy: boolean) => boolean | HTMLImageElement;
    saveAsJPEG: (oCanvas: HTMLCanvasElement, bReturnImg: boolean, iWidth: number, iHeight: number, flipy: boolean) => boolean | HTMLImageElement;
    saveAsBMP: (oCanvas: HTMLCanvasElement, bReturnImg: boolean, iWidth: number, iHeight: number, flipy: boolean) => boolean | HTMLImageElement;
};
