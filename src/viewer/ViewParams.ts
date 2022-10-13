
/**
 * {@link View} creation parameters for {@link Viewer.createView}.
 */
export interface ViewParams {
    id?: number | string;
    origin?: number[];
    scale?: number;
    units?: string;
    canvasId?: string;
    canvasElement?: HTMLCanvasElement;
    backgroundColor?: any[];
    backgroundColorFromAmbientLight?: boolean;
    premultipliedAlpha?: boolean;
    transparent?: boolean;
    pbrEnabled?: boolean;
    colorTextureEnabled?: boolean;
}