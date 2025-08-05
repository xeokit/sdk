import type {View, Viewer} from "../viewer";
import {WEBGL_INFO, type WebGLAbstractTexture} from "../webglutils";
import type {FloatArrayParam} from "../math";
import type {WebGLRenderer} from "./WebGLRenderer";
import {DTXMemory} from "./dtx/DTXMemory";

/**
 * @internal
 */
export class RenderContext {

  /**
   * The Viewer.
   */
  public viewer: Viewer;

  /**
   * The View we are currently rendering.
   */
  public view: View;

  /**
   * The WebGL rendering context.
   */
  public gl: WebGL2RenderingContext;

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
   * Whether backfaces are currently enabled during the current frame.
   */
  public backfaces: boolean;

  /**
   * The vertex winding order for what we currently consider to be a backface during current
   * frame: true == "cw", false == "ccw".
   */
  public frontface: boolean;

  /**
   * The next available texture unit to bind a texture to.
   */
  public textureUnit: number;

  /**
   * Statistic that counts how many times ````gl.bindTexture()```` has been called so far within the current frame.
   */
  public bindTexture: number;

  /**
   * Indicates which pass the renderers is currently rendering.
   */
  public renderPass: number;

  /**
   * The 4x4 viewing transform matrix the renderers is currently using when rendering castsShadows.
   *
   * This sets the viewpoint to look from the point of view of each {@link view!DirLight | DirLight}
   * or {@link view!PointLight|PointLight} that casts a shadow.
   */
  public shadowViewMatrix: FloatArrayParam;

  /**
   * The 4x4 viewing projection matrix the renderers is currently using when rendering shadows.
   */
  public shadowProjMatrix: FloatArrayParam;

  /**
   * The 4x4 viewing transform matrix the renderers is currently using when rendering a ray-pick.
   *
   * This sets the viewpoint to look along the ray, when picking with a ray.
   */
  public pickViewMatrix: FloatArrayParam;

  /**
   * The 4x4 orthographic projection transform matrix the renderers is currently using when rendering a ray-pick.
   */
  public pickProjMatrix: FloatArrayParam;

  /**
   * Distance to the near clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
   */
  public pickZNear: number;

  /**
   * Distance to the far clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
   */
  public pickZFar: number;

  /**
   * Whether or not the renderers is currently picking invisible objects.
   */
  public pickInvisible: boolean;

  /** The current line width.
   */
  public lineWidth: number;

  /**
   * ID of the last WebGLProgram that was bound during the current frame.
   */
  public lastProgramId: number;

  /**
   * The occlusion rendering texture.
   */
  public saoOcclusionTexture: WebGLAbstractTexture | null;

  public pickClipPos: FloatArrayParam;

  public webglRenderer: WebGLRenderer;

  /**
   * GPU-side memory for our model geometry and materials.
   */
  public dtxMemory: DTXMemory;

  /**
   * @private
   */
  constructor(viewer: Viewer, gl: WebGL2RenderingContext, webglRenderer: WebGLRenderer, dtxMemory: DTXMemory) {
    this.viewer = viewer;
    this.view = null;
    this.gl = gl;
    this.webglRenderer = webglRenderer;
    this.dtxMemory = dtxMemory;
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
