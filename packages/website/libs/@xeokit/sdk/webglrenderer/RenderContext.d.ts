import type { View, Viewer } from "../viewer";
import { type WebGLAbstractTexture, WebGLDataTexture } from "../webglutils";
import { FloatArrayParam } from "../math";
import { WebGLRenderer } from "./WebGLRenderer";
/**
 * @private
 */
export declare class RenderContext {
    /**
     * The Viewer.
     */
    viewer: Viewer;
    /**
     * @private
     */
    rendererSets: {};
    /**
     * The View we are rendering.
     */
    view: View;
    /**
     * The WebGL rendering context.
     */
    gl: WebGL2RenderingContext;
    viewMatrixDataTexture: WebGLDataTexture;
    /**
     * Whether to draw a quality representation for triangle surfaces.
     *
     * When ````false````, we'll draw them with a fast vertex-shaded Gouraud-shaded representation, which
     * is great for zillions of objects.
     *
     * When ````true````, we'll draw them at a better visual quality, using smooth, per-fragment shading
     * and a more realistic lighting model.
     */
    pbrEnabled: boolean;
    /**
     * Whether backfaces are currently enabled during the current frame.
     */
    backfaces: boolean;
    /**
     * The vertex winding order for what we currently consider to be a backface during current
     * frame: true == "cw", false == "ccw".
     */
    frontface: boolean;
    /**
     * The next available texture unit to bind a {@link WebGLAbstractTexture} to.
     */
    textureUnit: number;
    /**
     * Statistic that counts how many times ````gl.bindTexture()```` has been called so far within the current frame.
     */
    bindTexture: number;
    /**
     * Indicates which pass the renderers is currently rendering.
     */
    renderPass: number;
    /**
     * The 4x4 viewing transform matrix the renderers is currently using when rendering castsShadows.
     *
     * This sets the viewpoint to look from the point of view of each {@link DirLight}
     * or {@link PointLight} that casts a shadow.
     */
    shadowViewMatrix: any;
    /**
     * The 4x4 viewing projection matrix the renderers is currently using when rendering shadows.
     */
    shadowProjMatrix: any;
    /**
     * The 4x4 viewing transform matrix the renderers is currently using when rendering a ray-pick.
     *
     * This sets the viewpoint to look along the ray given to {@link scene!Scene/pick:method"}}Scene#pick(){{/crossLink}}
     * when picking with a ray.
     */
    pickViewMatrix: any;
    /**
     * The 4x4 orthographic projection transform matrix the renderers is currently using when rendering a ray-pick.
     */
    pickProjMatrix: any;
    /**
     * Distance to the near clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
     */
    pickZNear: number;
    /**
     * Distance to the far clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
     */
    pickZFar: number;
    /**
     * Whether or not the renderers is currently picking invisible objects.
     */
    pickInvisible: boolean;
    /** The current line width.
     */
    lineWidth: number;
    /**
     * ID of the last {@link WebGLProgram} that was bound during the current frame.
     */
    lastProgramId: number;
    /**
     * The occlusion rendering texture.
     */
    saoOcclusionTexture: WebGLAbstractTexture | null;
    pickClipPos: FloatArrayParam;
    webglRenderer: WebGLRenderer;
    constructor(viewer: Viewer, gl: WebGL2RenderingContext, webglRenderer: WebGLRenderer);
    /**
     * Called by the renderers before each frame.
     */
    reset(): void;
    /**
     * Gets the next available texture unit for this draw
     */
    get nextTextureUnit(): number;
}
//# sourceMappingURL=RenderContext.d.ts.map
