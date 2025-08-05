import type {SceneMesh} from "../../scene";
import type {FloatArrayParam} from "../../math";
import {MeshCounts} from "../MeshCounts";
import type {RenderContext} from "../RenderContext";
import {OBJECT_FLAGS} from "../OBJECT_FLAGS";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {LayerRendererSet} from "../renderers/LayerRendererSet";
import {RenderFlags} from "../RenderFlags";
import {type LayerParams} from "./LayerParams";

import {rendererFactory as trianglesRendererFactory} from "../renderers/triangles/rendererFactory";
import {PointsPrimitive, TrianglesPrimitive} from "../../constants";

const rendererFactories = {
  [TrianglesPrimitive]: trianglesRendererFactory
};

/**
 * A Layer manages a batch of SceneMeshes that use the same primitive type (e.g., triangles).
 * It tracks visibility and render state flags, delegates drawing to appropriate renderers,
 * and manages GPU memory via the RenderContext.
 */
export class Layer {
  #rendererSet: LayerRendererSet;

  renderContext: RenderContext;
  meshCounts: MeshCounts[];
  primitive: number;
  sortId: string;
  saoSupported: boolean;
  renderFlags: RenderFlags[];
  numIndices: number;

  constructor(layerParams: LayerParams) {
    const {renderContext, primitive} = layerParams;

    this.renderContext = renderContext;
    this.primitive = primitive;
    this.sortId = `Layer-${primitive}`;
    this.numIndices = 0;
    this.saoSupported = false;

    const factory = rendererFactories[primitive];
    if (!factory) {
      throw new Error(`Unsupported primitive type: ${primitive}`);
    }

    this.#rendererSet = factory.getRenderers(renderContext.webglRenderer);

    // Preallocate meshCounts and renderFlags for 4 views
    this.meshCounts = Array.from({length: 4}, () => new MeshCounts());
    this.renderFlags = Array.from({length: 4}, () => new RenderFlags());
  }

  get hash(): string {
    return `${this.primitive}`;
  }

  /**
   * Whether a mesh can be added to this layer (always true for now).
   */
  canAddMesh(sceneMesh: SceneMesh): boolean {
    return true;
  }

  /**
   * Adds a mesh to the layer and updates GPU memory and counters.
   */
  addMesh(sceneMesh: SceneMesh): number {
    const meshIndex = this.renderContext.dtxMemory.addMesh(sceneMesh);
    const geometry = sceneMesh.geometry;
    this.numIndices += geometry.primitive === PointsPrimitive
      ? geometry.positionsCompressed.length / 3
      : geometry.indices.length;
    for (const counts of this.meshCounts) {
      counts.numMeshes++;
    }
    return meshIndex;
  }

  /**
   * Removes a mesh from the layer.
   */
  removeMesh(sceneMesh: SceneMesh, viewFlags: number[]): void {
    this.renderContext.dtxMemory.removeMesh(sceneMesh);
    for (let viewIndex = 0; viewIndex < 4; viewIndex++) {
      const counts = this.meshCounts[viewIndex];
      const flags = viewFlags[viewIndex];
      if ((flags & OBJECT_FLAGS.VISIBLE) !== 0) counts.numVisible--;
      if ((flags & OBJECT_FLAGS.HIGHLIGHTED) !== 0) counts.numHighlighted--;
      if ((flags & OBJECT_FLAGS.XRAYED) !== 0) counts.numXRayed--;
      if ((flags & OBJECT_FLAGS.SELECTED) !== 0) counts.numSelected--;
      if ((flags & OBJECT_FLAGS.CLIPPABLE) !== 0) counts.numClippable--;
      if ((flags & OBJECT_FLAGS.PICKABLE) !== 0) counts.numPickable--;
      if ((flags & OBJECT_FLAGS.CULLED) !== 0) counts.numCulled--;
      if ((flags & OBJECT_FLAGS.TRANSPARENT) !== 0) counts.numTransparent--;
      counts.numMeshes--;
    }
    const geometry = sceneMesh.geometry;
    this.numIndices -= geometry.primitive === PointsPrimitive
      ? geometry.positionsCompressed.length / 3
      : geometry.indices.length;
  }

  /**
   * Initializes mesh visibility and interaction counters for a given view,
   * based on initial flags and transparency state.
   *
   * @param viewIndex - Index of the view.
   * @param meshIndex - Index of the mesh within the layer.
   * @param flags - Bitmask of OBJECT_FLAGS representing initial mesh states.=
   */
  initMeshFlags(viewIndex: number, meshIndex: number, flags: number): void {
    const counts = this.meshCounts[viewIndex];
    if ((flags & OBJECT_FLAGS.VISIBLE) !== 0) counts.numVisible++;
    if ((flags & OBJECT_FLAGS.HIGHLIGHTED) !== 0) counts.numHighlighted++;
    if ((flags & OBJECT_FLAGS.XRAYED) !== 0) counts.numXRayed++;
    if ((flags & OBJECT_FLAGS.SELECTED) !== 0) counts.numSelected++;
    if ((flags & OBJECT_FLAGS.CLIPPABLE) !== 0) counts.numClippable++;
    if ((flags & OBJECT_FLAGS.PICKABLE) !== 0) counts.numPickable++;
    if ((flags & OBJECT_FLAGS.CULLED) !== 0) counts.numCulled++;
    if ((flags & OBJECT_FLAGS.TRANSPARENT) !== 0) counts.numTransparent++;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  #setMeshObjectFlags(viewIndex: number, meshIndex: number, flags: number): void {
    const viewer = this.renderContext.viewer;
    const view = viewer.viewList[viewIndex];

    const isVisible = (flags & OBJECT_FLAGS.VISIBLE) !== 0;
    const isXRayed = (flags & OBJECT_FLAGS.XRAYED) !== 0;
    const isHighlighted = (flags & OBJECT_FLAGS.HIGHLIGHTED) !== 0;
    const isSelected = (flags & OBJECT_FLAGS.SELECTED) !== 0;
    const isPickable = (flags & OBJECT_FLAGS.PICKABLE) !== 0;
    const isCulled = (flags & OBJECT_FLAGS.CULLED) !== 0;
    const isClippable = (flags & OBJECT_FLAGS.CLIPPABLE) !== 0;
    const isTransparent = (flags & OBJECT_FLAGS.TRANSPARENT) !== 0;

    const notRenderable = !isVisible || isCulled;

    // Color flag (early return path fast)
    let colorFlag = RENDER_PASSES.NOT_RENDERED;
    if (!notRenderable) {
      const glowBlocked = (isHighlighted && !view.highlightMaterial.glowThrough) ||
        (isSelected && !view.selectedMaterial.glowThrough);
      if (!isXRayed && !glowBlocked) {
        colorFlag = isTransparent ? RENDER_PASSES.DRAW_TRANSPARENT : RENDER_PASSES.DRAW_OPAQUE;
      }
    }

    // Silhouette flag
    let silhouetteFlag = RENDER_PASSES.NOT_RENDERED;
    if (!notRenderable) {
      if (isSelected) {
        silhouetteFlag = RENDER_PASSES.SILHOUETTE_SELECTED;
      } else if (isHighlighted) {
        silhouetteFlag = RENDER_PASSES.SILHOUETTE_HIGHLIGHTED;
      } else if (isXRayed) {
        silhouetteFlag = RENDER_PASSES.SILHOUETTE_XRAYED;
      }
    }

    // Pick flag
    const pickFlag = (!notRenderable && isPickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;

    // Combine all flags into final bitfield
    const renderFlags =
      colorFlag |
      (silhouetteFlag << 4) |
      (pickFlag << 8) |
      (isClippable ? (1 << 12) : 0);

    // Apply attributes
    this.renderContext.dtxMemory.setMeshViewAttributes(meshIndex, viewIndex, {
      flags: renderFlags
    });
  }

  /**
   * Sete per-view  mesh visibility state.
   */
  setMeshVisible(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numVisible += (flags & OBJECT_FLAGS.VISIBLE) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh highlight state.
   */
  setMeshHighlighted(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numHighlighted += (flags & OBJECT_FLAGS.HIGHLIGHTED) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh x-ray state.
   */
  setMeshXRayed(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numXRayed += (flags & OBJECT_FLAGS.XRAYED) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh selected state.
   */
  setMeshSelected(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numSelected += (flags & OBJECT_FLAGS.SELECTED) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh clippable state.
   */
  setMeshClippable(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numClippable += (flags & OBJECT_FLAGS.CLIPPABLE) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh culling state.
   */
  setMeshCulled(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numCulled += (flags & OBJECT_FLAGS.CULLED) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh pickable state.
   */
  setMeshPickable(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numPickable += (flags & OBJECT_FLAGS.PICKABLE) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets transparency per-view for the mesh.
   */
  setMeshTransparent(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numTransparent += (flags & OBJECT_FLAGS.TRANSPARENT) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets a custom color per view for a mesh.
   */
  setMeshColor(viewIndex: number, meshIndex: number, color: FloatArrayParam): void {
    this.renderContext.dtxMemory.setMeshViewAttributes(meshIndex, viewIndex, {
      color: <number[]>color
    });
  }

  /**
   * Sets the transformation matrix for a mesh.
   */
  setMeshMatrix(meshIndex: number, rtcMatrix: FloatArrayParam): void {
    this.renderContext.dtxMemory.setMeshMatrix(meshIndex, rtcMatrix);
  }

  /**
   * Sets the tile index for a mesh.
   */
  setMeshTile(meshIndex: number, tileIndex: number): void {
    this.renderContext.dtxMemory.setMeshAttributes(meshIndex, {
      tileIndex
    });
  }

  /**
   * Recomputes render flags for a view.
   */
  rebuildRenderFlags(viewIndex: number): void {
    const renderFlags = this.renderFlags[viewIndex];
    renderFlags.reset();
    this.#updateRenderFlags(viewIndex);
  }

  #updateRenderFlags(viewIndex: number): void {
    const meshCounts = this.meshCounts[viewIndex];

    const numMeshes = meshCounts.numMeshes;
    if (meshCounts.numVisible === 0 || meshCounts.numCulled === numMeshes) return;

    const numTransparent = meshCounts.numTransparent;
    const isTransparent = numTransparent > 0;
    const isPartiallyOpaque = numTransparent < numMeshes;

    const renderFlags = this.renderFlags[viewIndex];
    const view = this.renderContext.viewer.viewList[viewIndex]; // Fixed: viewer[viewIndex] → viewList

    // Opaque and Transparent color flags
    renderFlags.colorOpaque = isPartiallyOpaque;
    renderFlags.colorTransparent = isTransparent;

    // XRAYED
    if (meshCounts.numXRayed > 0) {
      const xrayMaterial = view.xrayMaterial;
      const fillAlpha = xrayMaterial.fillAlpha;
      const edgeAlpha = xrayMaterial.edgeAlpha;
      renderFlags.xrayedSilhouetteOpaque = xrayMaterial.fill && fillAlpha >= 1.0;
      renderFlags.xrayedSilhouetteTransparent = xrayMaterial.fill && fillAlpha < 1.0;
      renderFlags.xrayedEdgesOpaque = xrayMaterial.edges && edgeAlpha >= 1.0;
      renderFlags.xrayedEdgesTransparent = xrayMaterial.edges && edgeAlpha < 1.0;
    }

    // EDGES
    const edgeMaterial = view.edges;
    if (edgeMaterial.applied) {
      renderFlags.edgesOpaque = isPartiallyOpaque;
      renderFlags.edgesTransparent = isTransparent;
    }

    // SELECTED
    if (meshCounts.numSelected > 0) {
      const selectedMaterial = view.selectedMaterial;
      const fillAlpha = selectedMaterial.fillAlpha;
      const edgeAlpha = selectedMaterial.edgeAlpha;
      renderFlags.selectedSilhouetteOpaque = selectedMaterial.fill && fillAlpha >= 1.0;
      renderFlags.selectedSilhouetteTransparent = selectedMaterial.fill && fillAlpha < 1.0;
      renderFlags.selectedEdgesOpaque = selectedMaterial.edges && edgeAlpha >= 1.0;
      renderFlags.selectedEdgesTransparent = selectedMaterial.edges && edgeAlpha < 1.0;
    }

    // HIGHLIGHTED
    if (meshCounts.numHighlighted > 0) {
      const highlightMaterial = view.highlightMaterial;
      const fillAlpha = highlightMaterial.fillAlpha;
      const edgeAlpha = highlightMaterial.edgeAlpha;
      renderFlags.highlightedSilhouetteOpaque = highlightMaterial.fill && fillAlpha >= 1.0;
      renderFlags.highlightedSilhouetteTransparent = highlightMaterial.fill && fillAlpha < 1.0;
      renderFlags.highlightedEdgesOpaque = highlightMaterial.edges && edgeAlpha >= 1.0;
      renderFlags.highlightedEdgesTransparent = highlightMaterial.edges && edgeAlpha < 1.0;
    }
  }

  /**
   * Renders opaque color meshes for the current view if there are visible meshes.
   * Checks if all meshes are culled, invisible, or transparent before rendering.
   */
  drawColorOpaque() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numTransparent, numXRayed, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numTransparent === numMeshes ||
      numXRayed === numMeshes
    ) {
      return;
    }
    this.#rendererSet.colorRenderer?.renderLayer(this, RENDER_PASSES.DRAW_OPAQUE);
  }

  /**
   * Renders opaque color meshes using Screen Space Ambient Occlusion (SSAO) for the current view if there are visible meshes.
   * Checks if all meshes are culled, invisible, or transparent before rendering.
   */
  drawColorSAOOpaque() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numTransparent, numXRayed, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numTransparent === numMeshes ||
      numXRayed === numMeshes
    ) {
      return;
    }
    this.#rendererSet.colorSAORenderer?.renderLayer(this, RENDER_PASSES.DRAW_OPAQUE);
  }

  /**
   * Renders translucent color meshes for the current view if there are visible meshes.
   * Checks if all meshes are culled, invisible, or if there are no transparent meshes before rendering.
   */
  drawColorTranslucent() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numTransparent, numXRayed, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numTransparent === 0 ||
      numXRayed === numMeshes
    ) {
      return;
    }
    this.#rendererSet.colorRenderer?.renderLayer(this, RENDER_PASSES.DRAW_TRANSPARENT);
  }

  /**
   * Renders the depth of opaque meshes for the current view if there are visible meshes.
   * Checks if all meshes are culled, invisible, or transparent before rendering.
   */
  drawDepth() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numTransparent, numXRayed, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numTransparent === numMeshes ||
      numXRayed === numMeshes
    ) {
      return;
    }
    this.#rendererSet.drawDepthRenderer?.renderLayer(this, RENDER_PASSES.DRAW_OPAQUE);
  }

  /**
   * Renders normals for the current view if there are visible meshes.
   * Checks if all meshes are culled or invisible before rendering.
   */
  drawNormals() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numTransparent, numXRayed, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numTransparent === numMeshes ||
      numXRayed === numMeshes
    ) {
      return;
    }
    // this.#rendererSet.normalsRenderer?.renderLayer(this, RENDER_PASSES.DRAW_OPAQUE);
  }

  /**
   * Renders the silhouette of XRayed meshes for the current view if there are visible XRayed meshes.
   * Checks if all meshes are culled, invisible, or if there are no XRayed meshes before rendering.
   */
  drawSilhouetteXRayed() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numXRayed, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numXRayed === 0
    ) {
      return;
    }
    this.#rendererSet.silhouetteRenderer?.renderLayer(this, RENDER_PASSES.SILHOUETTE_XRAYED);
  }

  /**
   * Renders the silhouette of highlighted meshes for the current view if there are visible highlighted meshes.
   * Checks if all meshes are culled, invisible, or if there are no highlighted meshes before rendering.
   */
  drawSilhouetteHighlighted() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numHighlighted, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numHighlighted === 0
    ) {
      return;
    }
    this.#rendererSet.silhouetteRenderer?.renderLayer(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
  }

  /**
   * Renders the silhouette of selected meshes for the current view if there are visible selected meshes.
   * Checks if all meshes are culled, invisible, or if there are no selected meshes before rendering.
   */
  drawSilhouetteSelected() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numSelected, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numSelected === 0
    ) {
      return;
    }
    this.#rendererSet.silhouetteRenderer?.renderLayer(this, RENDER_PASSES.SILHOUETTE_SELECTED);
  }

  /**
   * Renders edges of opaque color meshes for the current view if there are visible meshes.
   * Checks if all meshes are culled or invisible before rendering.
   */
  drawEdgesColorOpaque() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0
    ) {
      return;
    }
    this.#rendererSet.edgesColorRenderer?.renderLayer(this, RENDER_PASSES.DRAW_OPAQUE);
  }

  /**
   * Renders edges of translucent color meshes for the current view if there are visible meshes.
   * Checks if all meshes are culled, invisible, or if there are no transparent meshes before rendering.
   */
  drawEdgesColorTranslucent() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numTransparent, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numTransparent === 0
    ) {
      return;
    }
    this.#rendererSet.edgesColorRenderer?.renderLayer(this, RENDER_PASSES.DRAW_TRANSPARENT);
  }

  /**
   * Renders highlighted edges for the current view if there are visible highlighted meshes.
   * Checks if all meshes are culled, invisible, or if there are no highlighted meshes before rendering.
   */
  drawEdgesHighlighted() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numHighlighted, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numHighlighted === 0
    ) {
      return;
    }
    this.#rendererSet.edgesSilhouetteRenderer?.renderLayer(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
  }

  /**
   * Renders selected edges for the current view if there are visible selected meshes.
   * Checks if all meshes are culled, invisible, or if there are no selected meshes before rendering.
   */
  drawEdgesSelected() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numSelected, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numSelected === 0
    ) {
      return;
    }
    this.#rendererSet.edgesSilhouetteRenderer?.renderLayer(this, RENDER_PASSES.SILHOUETTE_SELECTED);
  }

  /**
   * Renders edges of XRayed meshes for the current view if there are visible XRayed meshes.
   * Checks if all meshes are culled, invisible, or if there are no XRayed meshes before rendering.
   */
  drawEdgesXRayed() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numXRayed, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0 ||
      numXRayed === 0
    ) {
      return;
    }
    this.#rendererSet.edgesSilhouetteRenderer?.renderLayer(this, RENDER_PASSES.SILHOUETTE_XRAYED);
  }

  /**
   * Renders occlusion for the current view if there are visible meshes.
   * Checks if all meshes are culled or invisible before rendering.
   */
  drawOcclusion() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0
    ) {
      return;
    }
    this.#rendererSet.occlusionRenderer?.renderLayer(this, RENDER_PASSES.DRAW_OPAQUE);
  }

  /**
   * Renders shadows for the current view if there are visible meshes.
   * Checks if all meshes are culled or invisible before rendering.
   */
  drawShadow() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0
    ) {
      return;
    }
    // this.#rendererSet.shadowRenderer?.render(this, RENDER_PASSES.DRAW_OPAQUE);
  }

  /**
   * Renders the pick mesh for the current view if there are visible meshes.
   * Checks if there are any visible meshes before rendering.
   */
  drawPickMesh() {
    const {viewIndex} = this.renderContext.view;
    const {numVisible} = this.meshCounts[viewIndex];
    if (numVisible === 0) return;
    this.#rendererSet.pickMeshRenderer?.renderLayer(this, RENDER_PASSES.PICK);
  }

  /**
   * Renders pick depths for the current view if there are visible meshes.
   * Checks if there are any visible meshes before rendering.
   */
  drawPickDepths() {
    const {viewIndex} = this.renderContext.view;
    const {numVisible} = this.meshCounts[viewIndex];
    if (numVisible === 0) return;
    this.#rendererSet.pickDepthRenderer?.renderLayer(this, RENDER_PASSES.PICK);
  }

  /**
   * Initializes snap rendering for the current view if there are visible meshes.
   * Checks if all meshes are culled or invisible before rendering.
   */
  drawSnapInit() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0
    ) {
      return;
    }
    this.#rendererSet.snapInitRenderer?.renderLayer(this, RENDER_PASSES.PICK);
  }

  /**
   * Renders snap for the current view if there are visible meshes.
   * Checks if all meshes are culled or invisible before rendering.
   */
  drawSnap() {
    const {viewIndex} = this.renderContext.view;
    const counts = this.meshCounts[viewIndex];
    const {numCulled, numVisible, numMeshes} = counts;
    if (
      numCulled === numMeshes ||
      numVisible === 0
    ) {
      return;
    }
    this.#rendererSet.snapRenderer?.renderLayer(this, RENDER_PASSES.PICK);
  }

  /**
   * Renders pick normals for the current view if there are visible meshes.
   * Checks if all meshes are culled or invisible before rendering.
   * Note: The rendering logic is currently commented out.
   */
  drawPickNormals() {
    // if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes || this.meshCounts[viewIndex].numVisible === 0) {
    //     return;
    // }
    // if (this.#rendererSet.pickNormalsRenderer) {
    //     this.#rendererSet.pickNormalsRenderer.render(this, RENDER_PASSES.PICK);
    // }
  }


  /**
   * Destroys this Layer instance.
   */
  destroy(): void {
    // Hook for cleanup if needed
  }

  // Internal methods (#setMeshObjectFlags, #updateRenderFlags) omitted for brevity
}
