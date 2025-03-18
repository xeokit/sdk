import { WEBGL_INFO } from "../webglutils";
/**
 * @private
 */
export class RenderContext {
    /**
     * The Viewer.
     */
    viewer;
    /**
     * @private
     */
    rendererSets;
    /**
     * The View we are rendering.
     */
    view;
    /**
     * The WebGL rendering context.
     */
    gl;
    viewMatrixDataTexture;
    /**
     * Whether to render a quality representation for triangle surfaces.
     *
     * When ````false````, we'll render them with a fast vertex-shaded Gouraud-shaded representation, which
     * is great for zillions of objects.
     *
     * When ````true````, we'll render them at a better visual quality, using smooth, per-fragment shading
     * and a more realistic lighting model.
     */
    pbrEnabled;
    /**
     * Whether backfaces are currently enabled during the current frame.
     */
    backfaces;
    /**
     * The vertex winding order for what we currently consider to be a backface during current
     * frame: true == "cw", false == "ccw".
     */
    frontface;
    /**
     * The next available texture unit to bind a {@link WebGLAbstractTexture} to.
     */
    textureUnit;
    /**
     * Statistic that counts how many times ````gl.bindTexture()```` has been called so far within the current frame.
     */
    bindTexture;
    /**
     * Indicates which pass the renderers is currently rendering.
     */
    renderPass;
    /**
     * The 4x4 viewing transform matrix the renderers is currently using when rendering castsShadows.
     *
     * This sets the viewpoint to look from the point of view of each {@link DirLight}
     * or {@link PointLight} that casts a shadow.
     */
    shadowViewMatrix;
    /**
     * The 4x4 viewing projection matrix the renderers is currently using when rendering shadows.
     */
    shadowProjMatrix;
    /**
     * The 4x4 viewing transform matrix the renderers is currently using when rendering a ray-pick.
     *
     * This sets the viewpoint to look along the ray given to {@link scene!Scene/pick:method"}}Scene#pick(){{/crossLink}}
     * when picking with a ray.
     */
    pickViewMatrix;
    /**
     * The 4x4 orthographic projection transform matrix the renderers is currently using when rendering a ray-pick.
     */
    pickProjMatrix;
    /**
     * Distance to the near clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
     */
    pickZNear;
    /**
     * Distance to the far clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
     */
    pickZFar;
    /**
     * Whether or not the renderers is currently picking invisible objects.
     */
    pickInvisible;
    /** The current line width.
     */
    lineWidth;
    /**
     * ID of the last {@link WebGLProgram} that was bound during the current frame.
     */
    lastProgramId;
    /**
     * The occlusion rendering texture.
     */
    saoOcclusionTexture;
    pickClipPos;
    webglRenderer;
    constructor(viewer, gl, webglRenderer) {
        this.viewer = viewer;
        this.view = null;
        this.gl = gl;
        this.webglRenderer = webglRenderer;
        this.reset();
    }
    /**
     * Called by the renderers before each frame.
     */
    reset() {
        this.lastProgramId = -1;
        this.pbrEnabled = false;
        this.backfaces = false;
        this.frontface = true;
        this.textureUnit = 0;
        this.shadowViewMatrix = null;
        this.shadowProjMatrix = null;
        this.pickViewMatrix = null;
        this.pickProjMatrix = null;
        this.pickZNear = 0.01;
        this.pickZFar = 5000;
        this.pickInvisible = false;
        this.lineWidth = 1;
        this.saoOcclusionTexture = null;
    }
    /**
     * Gets the next available texture unit for this render
     */
    get nextTextureUnit() {
        const textureUnit = this.textureUnit;
        this.textureUnit = (this.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
        return textureUnit;
    }
}
//# sourceMappingURL=RenderContext.js.map