import type { SceneObjectRendererProxy} from "../../../scene";
import type {FloatArrayParam} from "../../../math";
import {createDefaultRenderFlags, createRenderFlags, RENDER_FLAGS} from './RENDER_FLAGS';
import type {RendererMesh} from "./RendererMesh";
import {RenderContext} from "../../RenderContext";

const tempIntRGB = new Uint16Array([0, 0, 0]);

/**
 * Represents a 3D object in the WebGL renderer. This is a proxy
 * through which each ViewObject controls the visual state of the object in the renderer.
 * @private
 */
export class RendererObject implements SceneObjectRendererProxy {

  /**
   * Unique identifier for the object.
   * This ID is used to reference the object within the renderer.
   */
  readonly id: string;

  /**
   * List of renderer meshes associated with this object.
   * Each mesh can represent a part of the object, such as its geometry and texture.
   * The object controls the visual state of these meshes in the renderer, as a whole.
   */
  private readonly _rendererMeshes: RendererMesh[];

  /**
   * The RenderContext associated with this object.
   */
  private readonly _renderContext: RenderContext;

  /**
   * Rendering flags for the object in each view.
   */
   readonly renderFlags: number[];

  /**
   * @private
   */
  constructor(params: {
    id: string,
    renderContext: RenderContext;
    rendererMeshes: RendererMesh[];
  }) {
    this.id = params.id;
    this.renderFlags = [];
    this._rendererMeshes = params.rendererMeshes || [];
    this._renderContext = params.renderContext;
    this._initFlags();
  }

  _initFlags() {
    const viewer = this._renderContext.viewer;
    for (let viewIndex = 0, len = viewer.viewList.length; viewIndex < len; viewIndex++) {
      if (viewIndex < viewer.numViews) {
        const view = viewer.viewList[viewIndex];
        const viewObject = view.objects[this.id];
        this.renderFlags[viewIndex] = viewObject ? createRenderFlags(viewObject) : createDefaultRenderFlags();
      } else {
        this.renderFlags[viewIndex] = createDefaultRenderFlags();
      }
      for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
        this._rendererMeshes[i].initFlags(viewIndex, this.renderFlags[viewIndex]);
      }
    }
  }

  /**
   * Sets the visibility of the object in a specific view.
   */
  setVisible(viewIndex: number, visible: boolean): void {
    if (!!(this.renderFlags[viewIndex] & RENDER_FLAGS.VISIBLE) === visible) {
      return;
    }
    this.renderFlags[viewIndex] = visible ? this.renderFlags[viewIndex] | RENDER_FLAGS.VISIBLE : this.renderFlags[viewIndex] & ~RENDER_FLAGS.VISIBLE;
    this._rendererMeshes.forEach(mesh => mesh.setVisible(viewIndex, this.renderFlags[viewIndex]));
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the highlighted state of the object in a specific view.
   */
  setHighlighted(viewIndex: number, highlighted: boolean): void {
    if (!!(this.renderFlags[viewIndex] & RENDER_FLAGS.HIGHLIGHTED) === highlighted) {
      return;
    }
    this.renderFlags[viewIndex] = highlighted ? this.renderFlags[viewIndex] | RENDER_FLAGS.HIGHLIGHTED : this.renderFlags[viewIndex] & ~RENDER_FLAGS.HIGHLIGHTED;
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setHighlighted(viewIndex, this.renderFlags[viewIndex]);
    }
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the XRayed state of the object in a specific view.
   */
  setXRayed(viewIndex: number, xrayed: boolean): void {
    if (!!(this.renderFlags[viewIndex] & RENDER_FLAGS.XRAYED) === xrayed) {
      return;
    }
    this.renderFlags[viewIndex] = xrayed ? this.renderFlags[viewIndex] | RENDER_FLAGS.XRAYED : this.renderFlags[viewIndex] & ~RENDER_FLAGS.XRAYED;
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setXRayed(viewIndex, this.renderFlags[viewIndex]);
    }
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the selected state of the object in a specific view.
   */
  setSelected(viewIndex: number, selected: boolean): void {
    if (!!(this.renderFlags[viewIndex] & RENDER_FLAGS.SELECTED) === selected) {
      return;
    }
    this.renderFlags[viewIndex] = selected ? this.renderFlags[viewIndex] | RENDER_FLAGS.SELECTED : this.renderFlags[viewIndex] & ~RENDER_FLAGS.SELECTED;
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setSelected(viewIndex, this.renderFlags[viewIndex]);
    }
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the culled state of the object in a specific view.
   */
  setCulled(viewIndex: number, culled: boolean): void {
    if (!!(this.renderFlags[viewIndex] & RENDER_FLAGS.CULLED) === culled) {
      return;
    }
    this.renderFlags[viewIndex] = culled ? this.renderFlags[viewIndex] | RENDER_FLAGS.CULLED : this.renderFlags[viewIndex] & ~RENDER_FLAGS.CULLED;
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setCulled(viewIndex, this.renderFlags[viewIndex]);
    }
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the clippable state of the object in a specific view.
   */
  setClippable(viewIndex: number, clippable: boolean): void {
    if ((!!(this.renderFlags[viewIndex] & RENDER_FLAGS.CLIPPABLE)) === clippable) {
      return;
    }
    this.renderFlags[viewIndex] = clippable ? this.renderFlags[viewIndex] | RENDER_FLAGS.CLIPPABLE : this.renderFlags[viewIndex] & ~RENDER_FLAGS.CLIPPABLE;
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setClippable(viewIndex, this.renderFlags[viewIndex]);
    }
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the collidable state of the object in a specific view.
   */
  setCollidable(viewIndex: number, collidable: boolean): void {
    if (!!(this.renderFlags[viewIndex] & RENDER_FLAGS.COLLIDABLE) === collidable) {
      return;
    }
    this.renderFlags[viewIndex] = collidable ? this.renderFlags[viewIndex] | RENDER_FLAGS.COLLIDABLE : this.renderFlags[viewIndex] & ~RENDER_FLAGS.COLLIDABLE;
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setCollidable(viewIndex, this.renderFlags[viewIndex]);
    }
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the pickable state of the object in a specific view.
   */
  setPickable(viewIndex: number, pickable: boolean): void {
    if (!!(this.renderFlags[viewIndex] & RENDER_FLAGS.PICKABLE) === pickable) {
      return;
    }
    this.renderFlags[viewIndex] = pickable ? this.renderFlags[viewIndex] | RENDER_FLAGS.PICKABLE : this.renderFlags[viewIndex] & ~RENDER_FLAGS.PICKABLE;
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setPickable(viewIndex, this.renderFlags[viewIndex]);
    }
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the colorize color of the object in a specific view.
   */
  setColorize(viewIndex: number, color?: FloatArrayParam): void { // [0..1, 0..1, 0..1]
    if (color) {
      tempIntRGB[0] = Math.floor(color[0] * 255.0); // Quantize
      tempIntRGB[1] = Math.floor(color[1] * 255.0);
      tempIntRGB[2] = Math.floor(color[2] * 255.0);
      for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
        this._rendererMeshes[i].setColorize(viewIndex, tempIntRGB);
      }
    } else {
      for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
        this._rendererMeshes[i].setColorize(viewIndex, null);
      }
    }
    this._renderContext.setViewDirty(viewIndex);
  }

  /**
   * Sets the opacity of the object in a specific view.
   */
  setOpacity(viewIndex: number, opacity?: number): void {
    if (this._rendererMeshes.length === 0) {
      return;
    }
    // @ts-ignore
    const lastOpacityQuantized = this._rendererMeshes[0].colorize[3];
    let opacityQuantized = 255;
    if (opacity !== null && opacity !== undefined) {
      if (opacity < 0) {
        opacity = 0;
      } else if (opacity > 1) {
        opacity = 1;
      }
      opacityQuantized = Math.floor(opacity * 255.0); // Quantize
      // @ts-ignore
      if (lastOpacityQuantized === opacityQuantized) {
        return;
      }
    } else {
      opacityQuantized = 255.0;
      // @ts-ignore
      if (lastOpacityQuantized === opacityQuantized) {
        return;
      }
    }
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setOpacity(viewIndex, opacityQuantized);
    }
    this._renderContext.setViewDirty(viewIndex);
  }
}
