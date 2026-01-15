import type { Vec3} from "../../../math";
import type {RendererMesh} from "./RendererMesh";
import {RenderContext} from "../RenderContext";

const tempIntRGB = new Uint16Array([0, 0, 0]);

/**
 * Represents a logical renderable object within the WebGL renderer, grouping one or more {@link RendererMesh} instances.
 *
 * @remarks
 * - `RendererObject` is the GPU-side container for all meshes that make up a single scene/model object.
 * - Each `RendererObject` owns one or more {@link RendererMesh} instances, each representing a distinct mesh or geometry part of the object.
 * - Provides APIs to control visual and interaction state (visibility, highlighting, selection, x-ray, culling, clipping, collision, picking) across all its meshes and views.
 * - Delegates all geometry, GPU memory, and RTC tiling logic to its {@link RendererMesh} instances.
 * - `RendererMesh` instances are managed and batched by {@link MeshBatchImpl}, which organizes compatible meshes for efficient GPU upload and draw calls.
 * - The {@link MeshManager} (or MeshBatchRegistry) coordinates creation, update, and removal of `RendererObject` and `RendererMesh` instances, responding to scene/view changes and synchronizing with the GPU memory manager.
 * - The {@link ViewManager} manages all per-view state, coordinates with {@link MeshManager}, and tracks all `RendererObject` instances for each view.
 * - The root {@link WebGLRenderer} owns the {@link ViewManager}, which in turn manages all `RendererObject` instances for the renderer.
 * - Used internally by the renderer for efficient per-object state updates and synchronization with the GPU; application code interacts with higher-level scene/model objects.
 *
 * @internal
 */
export class RendererObject  {

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
   * @private
   */
  constructor(params: {
    id: string,
    renderContext: RenderContext;
    rendererMeshes: RendererMesh[];
  }) {
    this.id = params.id;
    this._rendererMeshes = params.rendererMeshes || [];
    this._renderContext = params.renderContext;
   }

  /**
   * Adds a renderer mesh to this object.
   */
  addRendererMesh(rendererMesh: RendererMesh) {
    this._rendererMeshes.push(rendererMesh);
  }

  /**
   * Removes a renderer mesh from this object.
   */
  removeRendererMesh(rendererMesh: RendererMesh) {
    const index = this._rendererMeshes.indexOf(rendererMesh);
    if (index !== -1) {
      this._rendererMeshes.splice(index, 1);
    }
  }

  /**
   * Sets the visibility of the object in a specific view.
   */
  setVisible(viewIndex: number, visible: boolean): void {
      this._rendererMeshes.forEach(mesh => mesh.setObjectVisible(viewIndex, visible));
  }

  /**
   * Sets the highlighted state of the object in a specific view.
   */
  setHighlighted(viewIndex: number, highlighted: boolean): void {
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setHighlighted(viewIndex, highlighted);
    }
  }

  /**
   * Sets the XRayed state of the object in a specific view.
   */
  setXRayed(viewIndex: number, xrayed: boolean): void {
      for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setXRayed(viewIndex, xrayed);
    }
  }

  /**
   * Sets the selected state of the object in a specific view.
   */
  setSelected(viewIndex: number, selected: boolean): void {
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setSelected(viewIndex,selected);
    }
  }

  /**
   * Sets the culled state of the object in a specific view.
   */
  setCulled(viewIndex: number, culled: boolean): void {
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setCulled(viewIndex, culled);
    }
  }

  /**
   * Sets the clippable state of the object in a specific view.
   */
  setClippable(viewIndex: number, clippable: boolean): void {
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setClippable(viewIndex, clippable);
    }
  }

  /**
   * Sets the collidable state of the object in a specific view.
   */
  setCollidable(viewIndex: number, collidable: boolean): void {
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setCollidable(viewIndex, collidable);
    }
  }

  /**
   * Sets the pickable state of the object in a specific view.
   */
  setPickable(viewIndex: number, pickable: boolean): void {
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setPickable(viewIndex, pickable);
    }
  }

  /**
   * Sets the colorize color of the object in a specific view.
   */
  setColorize(viewIndex: number, color?: Vec3): void { // [0..1, 0..1, 0..1]
    if (color) {
      tempIntRGB[0] = Math.floor(color[0] * 255.0); // Quantize
      tempIntRGB[1] = Math.floor(color[1] * 255.0);
      tempIntRGB[2] = Math.floor(color[2] * 255.0);
      for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
        this._rendererMeshes[i].setColorInView(viewIndex, tempIntRGB);
      }
    } else {
      for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
        this._rendererMeshes[i].setColorInView(viewIndex, null);
      }
    }
  }

  /**
   * Sets the opacity of the object in a specific view.
   */
  setOpacity(viewIndex: number, opacity?: number): void {
    if (this._rendererMeshes.length === 0) {
      return;
    }
    // @ts-ignore
    const lastOpacityQuantized = this._rendererMeshes[0].opacity;
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
      this._rendererMeshes[i].setOpacityInView(viewIndex, opacityQuantized);
    }
  }
}
