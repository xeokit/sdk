import type { Vec3 } from "../../../../../base/math/vector";
import type { RendererMesh } from "./RendererMesh";

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

  private readonly _rendererMeshes: RendererMesh[];

  constructor(params: {
    id: string,
    rendererMeshes: RendererMesh[];
  }) {
    this.id = params.id;
    this._rendererMeshes = params.rendererMeshes || [];
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
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setObjectVisible(viewIndex, visible);
    }
  }

  /**
   * Sets renderer-side LOD suppression in a specific view without mutating
   * application-visible ViewObject state.
   */
  setLODSuppressed(viewIndex: number, suppressed: boolean): void {
    for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
      this._rendererMeshes[i].setLODSuppressed(viewIndex, suppressed);
    }
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
   *
   * Pass `undefined` (or `null`) to **clear** the per-mesh opacity
   * override on each owned `RendererMesh`. The mesh's
   * `setOpacityInView` interprets a null/undefined argument as
   * "fall back to the SceneMesh's `effectiveOpacity` and clear the
   * `ColoringOpacity` flag" — exactly what's needed when the
   * upstream caller has cleared a ViewObject's opacity override
   * (e.g. a 4D scheduler returning a finished task's objects to
   * their native material alpha).
   *
   * Pass a number in `[0, 1]` to enable the override at that value;
   * the mesh-level method quantises and writes the per-mesh data
   * texture and sets the `ColoringOpacity` flag to true.
   *
   * Earlier behaviour clamped the null/undefined branch to a
   * literal 255 quantised opacity and forwarded the number — this
   * was visually equivalent to "force every mesh to alpha = 1.0",
   * which silently routed naturally-transparent glass and curtain-
   * wall meshes through the opaque render bin and produced uniform
   * silhouettes on schedule-finish.
   */
  setOpacity(viewIndex: number, opacity?: number | null): void {
    if (this._rendererMeshes.length === 0) {
      return;
    }
    if (opacity !== null && opacity !== undefined) {
      if (opacity < 0) opacity = 0;
      else if (opacity > 1) opacity = 1;
      const opacityQuantized = Math.floor(opacity * 255.0);
      for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
        this._rendererMeshes[i].setOpacityInView(viewIndex, opacityQuantized);
      }
    } else {
      // Forward null to the mesh-level setter so it falls back to
      // `sceneMesh.effectiveOpacity` and clears `ColoringOpacity`.
      for (let i = 0, len = this._rendererMeshes.length; i < len; i++) {
        this._rendererMeshes[i].setOpacityInView(viewIndex, null);
      }
    }
  }
}
