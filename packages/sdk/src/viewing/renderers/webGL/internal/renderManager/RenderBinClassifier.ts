import type {MeshBatch} from "../meshManager/MeshBatch";
import type {View} from "../../../../viewer";

import {RENDER_PASSES} from "../RENDER_PASSES";
import {TrianglesPrimitive} from "../../../../../base/constants";


/**
 * Pre-allocated bins the classifier sorts mesh batches into. RenderManager
 * owns the actual arrays; the classifier just receives a reference and
 * pushes into them. Names mirror the per-bin draw passes RenderManager runs.
 *
 * @internal
 */
export interface RenderBins {
  /** Plain opaque (no SAO, no shadow). Drawn with the basic opaque DrawOp. */
  normalDrawOpaque: MeshBatch[];
  /** Opaque batches that want SAO only. Drawn with `opaqueSAO`. */
  normalDrawSAO: MeshBatch[];
  /** Opaque batches that want shadows only. Drawn with `opaqueShadow`. */
  normalDrawShadow: MeshBatch[];
  /** Opaque batches that want both SAO + shadows. Drawn with `opaqueSAOShadow`. */
  normalDrawSAOShadow: MeshBatch[];
  /** Transparent batches that cast into the shadow map only. */
  normalShadowTransparent: MeshBatch[];

  normalEdgesOpaque: MeshBatch[];
  normalFillTransparent: MeshBatch[];
  normalEdgesTransparent: MeshBatch[];
  xrayedSilhouetteOpaque: MeshBatch[];
  xrayEdgesOpaque: MeshBatch[];
  xrayedSilhouetteTransparent: MeshBatch[];
  xrayEdgesTransparent: MeshBatch[];
  highlightedSilhouetteOpaque: MeshBatch[];
  highlightedEdgesOpaque: MeshBatch[];
  highlightedSilhouetteTransparent: MeshBatch[];
  highlightedEdgesTransparent: MeshBatch[];
  selectedSilhouetteOpaque: MeshBatch[];
  selectedEdgesOpaque: MeshBatch[];
  selectedSilhouetteTransparent: MeshBatch[];
  selectedEdgesTransparent: MeshBatch[];
}

/**
 * Per-frame flags telling the classifier which effects are available, so it
 * can route opaque batches to the right (SAO / shadow / combo) bin.
 *
 * @internal
 */
export interface RenderBinClassificationFlags {
  drawWithSAO: boolean;
  drawWithShadows: boolean;
}


/**
 * Sorts mesh batches into render bins based on:
 *   - what the batch contains in this view (opaque / transparent /
 *     xrayed / highlighted / selected fragments),
 *   - which effects (SAO, shadows) are available and supported by the batch,
 *   - the view's edge/silhouette material settings.
 *
 * Stateless on purpose — every call wipes all bins to zero length and
 * re-fills from scratch. Doesn't draw anything; bins are consumed by
 * RenderManager during the scene-render phase.
 *
 * @internal
 */
export class RenderBinClassifier {

  /**
   * Empties every bin in the set. Cheap (just sets `.length = 0` on
   * pre-allocated arrays).
   */
  clear(bins: RenderBins): void {
    bins.normalDrawOpaque.length = 0;
    bins.normalDrawSAO.length = 0;
    bins.normalDrawShadow.length = 0;
    bins.normalDrawSAOShadow.length = 0;
    bins.normalShadowTransparent.length = 0;
    bins.normalEdgesOpaque.length = 0;
    bins.normalFillTransparent.length = 0;
    bins.normalEdgesTransparent.length = 0;
    bins.xrayedSilhouetteOpaque.length = 0;
    bins.xrayEdgesOpaque.length = 0;
    bins.xrayedSilhouetteTransparent.length = 0;
    bins.xrayEdgesTransparent.length = 0;
    bins.highlightedSilhouetteOpaque.length = 0;
    bins.highlightedEdgesOpaque.length = 0;
    bins.highlightedSilhouetteTransparent.length = 0;
    bins.highlightedEdgesTransparent.length = 0;
    bins.selectedSilhouetteOpaque.length = 0;
    bins.selectedEdgesOpaque.length = 0;
    bins.selectedSilhouetteTransparent.length = 0;
    bins.selectedEdgesTransparent.length = 0;
  }

  /**
   * Walks `meshBatches` and pushes each into every bin it qualifies for.
   * Bins are not cleared automatically; call {@link clear} first.
   */
  classify(params: {
    meshBatches: ReadonlyArray<MeshBatch>;
    view: View;
    viewIndex: number;
    bins: RenderBins;
    flags: RenderBinClassificationFlags;
  }): void {
    const {meshBatches, view, viewIndex, bins, flags} = params;
    const edgeMaterial = view.effects.edges;
    const xrayMaterial = view.xrayMaterial;
    const highlightMaterial = view.highlightMaterial;
    const selectedMaterial = view.selectedMaterial;
    const lodVisibility = view.viewer?.lodVisibility;

    for (const meshBatch of meshBatches) {
      if (lodVisibility?.isRepMembershipSuppressed(view.id, meshBatch.lodRepMemberships)) {
        continue;
      }
      this._classifyBatch(meshBatch, viewIndex, bins, flags, edgeMaterial, xrayMaterial, highlightMaterial, selectedMaterial);
    }
  }

  private _classifyBatch(
    meshBatch: MeshBatch,
    viewIndex: number,
    bins: RenderBins,
    flags: RenderBinClassificationFlags,
    edgeMaterial: View["effects"]["edges"],
    xrayMaterial: View["xrayMaterial"],
    highlightMaterial: View["highlightMaterial"],
    selectedMaterial: View["selectedMaterial"]
  ): void {
    const opaque = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.OPAQUE);
    const transparent = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.TRANSPARENT);
    const xray = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.XRAYED);
    const highlight = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.HIGHLIGHTED);
    const select = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.SELECTED);
    const supportsEdgePasses = meshBatch.primitive === TrianglesPrimitive &&
      (meshBatch.geometryStorage === "dtx" || meshBatch.geometryStorage === "vbo");

    if (opaque) {
      // Overlay-bin batches skip SAO + shadow routing entirely. They
      // are "floating UI" by contract (drawn in a depth-cleared pass
      // after the rest of the scene), so they must not cast shadows
      // onto host geometry and must not contribute to ambient
      // occlusion — both effects would project the overlay back onto
      // the underlying scene as ghost outlines or dark blotches.
      if (meshBatch.bin !== undefined) {
        bins.normalDrawOpaque.push(meshBatch);
      } else {
        const wantSAO = flags.drawWithSAO && meshBatch.saoSupported;
        const wantShadow = flags.drawWithShadows && meshBatch.shadowsSupported;
        if (wantSAO && wantShadow) {
          bins.normalDrawSAOShadow.push(meshBatch);
        } else if (wantSAO) {
          bins.normalDrawSAO.push(meshBatch);
        } else if (wantShadow) {
          bins.normalDrawShadow.push(meshBatch);
        } else {
          bins.normalDrawOpaque.push(meshBatch);
        }
      }
    }

    if (transparent) {
      bins.normalFillTransparent.push(meshBatch);
      if (meshBatch.bin === undefined && flags.drawWithShadows && meshBatch.shadowsSupported) {
        bins.normalShadowTransparent.push(meshBatch);
      }
    }
    if (xray && xrayMaterial.fill) {
      (xrayMaterial.fillAlpha < 1.0
        ? bins.xrayedSilhouetteTransparent
        : bins.xrayedSilhouetteOpaque).push(meshBatch);
    }
    if (highlight && highlightMaterial.fill) {
      (highlightMaterial.fillAlpha < 1.0
        ? bins.highlightedSilhouetteTransparent
        : bins.highlightedSilhouetteOpaque).push(meshBatch);
    }
    if (select && selectedMaterial.fill) {
      (selectedMaterial.fillAlpha < 1.0
        ? bins.selectedSilhouetteTransparent
        : bins.selectedSilhouetteOpaque).push(meshBatch);
    }

    // Normal edges (the global "wireframe overlay" effect) are gated on
    // `view.effects.edges.applied`, which respects `Edges.enabled state`
    // (detailed profile by default).
    if (supportsEdgePasses && edgeMaterial.applied) {
      if (opaque) bins.normalEdgesOpaque.push(meshBatch);
      if (transparent) bins.normalEdgesTransparent.push(meshBatch);
    }

    // X-ray / highlight / selected edges are part of the visual identity
    // of those *modes* — they belong wherever an object is xrayed /
    // highlighted / selected, regardless of the global edges effect.
    // Gate them on each effect material's own `edges` flag (and require
    // a usable alpha) so e.g. flipping `View.active profile` to
    // realistic profile doesn't silently swallow the silhouettes.
    if (supportsEdgePasses && xray && xrayMaterial.edges && xrayMaterial.edgeAlpha > 0) {
      (xrayMaterial.edgeAlpha < 1.0 ? bins.xrayEdgesTransparent : bins.xrayEdgesOpaque).push(meshBatch);
    }
    if (supportsEdgePasses && highlight && highlightMaterial.edges && highlightMaterial.edgeAlpha > 0) {
      (highlightMaterial.edgeAlpha < 1.0 ? bins.highlightedEdgesTransparent : bins.highlightedEdgesOpaque).push(meshBatch);
    }
    if (supportsEdgePasses && select && selectedMaterial.edges && selectedMaterial.edgeAlpha > 0) {
      (selectedMaterial.edgeAlpha < 1.0 ? bins.selectedEdgesTransparent : bins.selectedEdgesOpaque).push(meshBatch);
    }
  }
}
