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
  styleBinFillOpaque: MeshBatch[];
  styleBinOverlayOpaque: MeshBatch[];
  styleBinEdgesOpaque: MeshBatch[];
  styleBinFillTransparent: MeshBatch[];
  styleBinOverlayTransparent: MeshBatch[];
  styleBinEdgesTransparent: MeshBatch[];
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
 *     resolved style-bin fragments),
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
    bins.styleBinFillOpaque.length = 0;
    bins.styleBinOverlayOpaque.length = 0;
    bins.styleBinEdgesOpaque.length = 0;
    bins.styleBinFillTransparent.length = 0;
    bins.styleBinOverlayTransparent.length = 0;
    bins.styleBinEdgesTransparent.length = 0;
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
    const lodVisibility = view.viewer?.lodVisibility;

    for (const meshBatch of meshBatches) {
      if (lodVisibility?.isRepMembershipSuppressed(view.id, meshBatch.lodRepMemberships)) {
        continue;
      }
      this._classifyBatch(meshBatch, viewIndex, bins, flags, edgeMaterial);
    }
  }

  private _classifyBatch(
    meshBatch: MeshBatch,
    viewIndex: number,
    bins: RenderBins,
    flags: RenderBinClassificationFlags,
    edgeMaterial: View["effects"]["edges"]
  ): void {
    const opaque = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.OPAQUE);
    const transparent = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.TRANSPARENT);
    const styleBinOpaque = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.STYLE_BIN_OPAQUE);
    const styleBinTransparent = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.STYLE_BIN_TRANSPARENT);
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
    // Normal edges (the global "wireframe overlay" effect) are gated on
    // `view.effects.edges.applied`, which respects `Edges.enabled state`
    // (detailed profile by default).
    if (supportsEdgePasses && edgeMaterial.applied) {
      if (opaque) bins.normalEdgesOpaque.push(meshBatch);
      if (transparent) bins.normalEdgesTransparent.push(meshBatch);
    }
    if (meshBatch.hasStyleBinClearDepthBefore(viewIndex)) {
      if (opaque) bins.styleBinOverlayOpaque.push(meshBatch);
      if (transparent) bins.styleBinOverlayTransparent.push(meshBatch);
    }
    if (styleBinOpaque) {
      bins.styleBinFillOpaque.push(meshBatch);
      if (supportsEdgePasses) {
        bins.styleBinEdgesOpaque.push(meshBatch);
      }
    }
    if (styleBinTransparent) {
      bins.styleBinFillTransparent.push(meshBatch);
      if (supportsEdgePasses) {
        bins.styleBinEdgesTransparent.push(meshBatch);
      }
    }

  }
}
