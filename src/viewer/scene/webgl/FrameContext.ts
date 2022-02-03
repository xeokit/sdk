import * as math from "../../math/";
import {createRTCViewMat, FloatArrayType} from "../../math";
import {Viewer} from "../../Viewer";

/**
 * @desc Provides rendering context to {@link Drawable"}s as xeokit renders them for a frame.
 *
 * Also creates RTC viewing and picking matrices, caching and reusing matrices within each frame.
 *
 * @private
 */
class FrameContext {

    public viewer: Viewer;

    /**
     * The WebGL rendering context.
     */
    public gl: WebGLRenderingContext;

    /**
     * Whether to render a quality representation for triangle surfaces.
     *
     * When ````false````, we'll render them with a fast vertex-shaded Gouraud-shaded representation, which
     * is great for zillions of objects.
     *
     * When ````true````, we'll render them at a better visual quality, using smooth, per-fragment shading
     * and a more realistic lighting model.
     */
    public pbrEnabled: boolean;

    /**
     * Whether SAO is currently enabled during the current frame.
     */
    public withSAO: boolean;

    /**
     * Whether backfaces are currently enabled during the current frame.
     */
    public backfaces: boolean;

    /**
     * The vertex winding order for what we currently consider to be a backface during current
     * frame: true == "cw", false == "ccw".
     */
    public frontface: boolean;

    /**
     * The next available texture unit to bind a {@link Texture} to.
     */
    public textureUnit: number;

    /**
     * Performance statistic that counts how many times the renderer has called ````gl.drawElements()```` has been
     * called so far within the current frame.
     */
    public drawElements: number;

    /**
     * Performance statistic that counts how many times ````gl.drawArrays()```` has been called so far within
     * the current frame.
     */
    public drawArrays: number;

    /**
     * Performance statistic that counts how many times ````gl.useProgram()```` has been called so far within
     * the current frame.
     */
    public useProgram: number;

    /**
     * Statistic that counts how many times ````gl.bindTexture()```` has been called so far within the current frame.
     */
    public bindTexture: number;

    /**
     * Counts how many times the renderer has called ````gl.bindArray()```` so far within the current frame.
     */
    public bindArray: number;

    /**
     * Indicates which pass the renderer is currently rendering.
     *
     * See {@link Scene/passes:property"}}Scene#passes{{/crossLink}}, which configures how many passes we render
     * per frame, which typically set to ````2```` when rendering a stereo view.
     */
    public pass: number;

    /**
     * The 4x4 viewing transform matrix the renderer is currently using when rendering castsShadows.
     *
     * This sets the viewpoint to look from the point of view of each {@link DirLight}
     * or {@link PointLight} that casts a shadow.
     */
    public shadowViewMatrix: any;

    /**
     * The 4x4 viewing projection matrix the renderer is currently using when rendering shadows.
     */
    public shadowProjMatrix: any;

    /**
     * The 4x4 viewing transform matrix the renderer is currently using when rendering a ray-pick.
     *
     * This sets the viewpoint to look along the ray given to {@link Scene/pick:method"}}Scene#pick(){{/crossLink}}
     * when picking with a ray.
     */
    public pickViewMatrix: any;

    /**
     * The 4x4 orthographic projection transform matrix the renderer is currently using when rendering a ray-pick.
     */
    public pickProjMatrix: any;

    /**
     * Distance to the near clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
     */
    public pickZNear: number;

    /**
     * Distance to the far clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
     */
    public pickZFar: number;

    /**
     * Whether or not the renderer is currently picking invisible objects.
     */
    public pickInvisible: boolean;

    /** The current line width.
     */
    public lineWidth: number;

    /**
     * ID of the last {@link WebGLProgram} that was bound during the current frame.
     */
    public lastProgramId: null;

    #matPool: any[];
    #matPoolNextFreeIndex: number;
    #rtcViewMats: { [key: string]: FloatArrayType };
    #rtcPickViewMats: { [key: string]: FloatArrayType };

    constructor(viewer: Viewer) {

        this.viewer = viewer;

        this.#matPool = [];
        this.#matPoolNextFreeIndex = 0;
        this.#rtcViewMats = {};
        this.#rtcPickViewMats = {};

        this.reset();
    }

    /**
     * Called by the renderer before each frame.
     */
    reset() {
        this.#matPoolNextFreeIndex = 0;
        this.#rtcViewMats = {};
        this.#rtcPickViewMats = {};
      //  this.gl = this.viewer.viewList[0].canvas.gl;
        this.gl = null;
        this.lastProgramId = null;
        this.pbrEnabled = false;
        this.withSAO = false;
        this.backfaces = false;
        this.frontface = true;
        this.textureUnit = 0;
        this.drawElements = 0;
        this.drawArrays = 0;
        this.useProgram = 0;
        this.bindTexture = 0;
        this.bindArray = 0;
        this.pass = 0;
        this.shadowViewMatrix = null;
        this.shadowProjMatrix = null;
        this.pickViewMatrix = null;
        this.pickProjMatrix = null;
        this.pickZNear = 0.01;
        this.pickZFar = 5000;
        this.pickInvisible = false;
        this.lineWidth = 1;
    }

    /**
     * Gets view matrix for the given RTC center
     */
    getRTCViewMatrix(originHash: string, origin: FloatArrayType): FloatArrayType {
        let rtcViewMat = this.#rtcViewMats[originHash];
        if (!rtcViewMat) {
            rtcViewMat = this.#getNewMat();
            createRTCViewMat(this.viewer.viewList[0].camera.viewMatrix, origin, rtcViewMat);
            this.#rtcViewMats[originHash] = rtcViewMat;
        }
        return rtcViewMat;
    }

    /**
     * Gets picking view RTC matrix for the given RTC center
     */
    getRTCPickViewMatrix(originHash: string, origin: FloatArrayType): FloatArrayType {
        let rtcPickViewMat = this.#rtcPickViewMats[originHash];
        if (!rtcPickViewMat) {
            rtcPickViewMat = this.#getNewMat();
            const pickViewMat = this.pickViewMatrix || this.viewer.viewList[0].camera.viewMatrix;
            createRTCViewMat(pickViewMat, origin, rtcPickViewMat);
            this.#rtcPickViewMats[originHash] = rtcPickViewMat;
        }
        return rtcPickViewMat;
    }

    #getNewMat() {
        let mat = this.#matPool[this.#matPoolNextFreeIndex];
        if (!mat) {
            mat = math.mat4();
            this.#matPool[this.#matPoolNextFreeIndex] = mat;
        }
        this.#matPoolNextFreeIndex++;
        return mat;
    }
}

export {FrameContext};