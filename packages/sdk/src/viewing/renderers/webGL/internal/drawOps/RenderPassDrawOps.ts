import {DrawOp} from "./DrawOp";

/**
 * Collection of draw operations for all render passes, for a specific primitive type.
 *
 * Each property represents a {@link DrawOp} used to render the given primitive type within a particular pass,
 * such as opaque, transparent, highlighted, selected, x-rayed, edge rendering, and picking.
 *
 * @internal
 */
export interface RenderPassDrawOps {

  /**
   * Draw operation for rendering opaque objects.
   */
  opaque?: DrawOp;

  /**
   * Draw operation for rendering opaque objects with SAO (Scalable Ambient Obscurance).
   */
  opaqueSAO?: DrawOp;

  /**
   * Draw operation that renders depth from the shadow-casting light's point of
   * view into the shadow-map FBO.
   */
  shadowDepth?: DrawOp;

  /**
   * Transparent-pass variant of {@link shadowDepth}, used when translucent
   * geometry contributes to the shadow map.
   */
  shadowDepthTransparent?: DrawOp;

  /**
   * Draw operation for rendering opaque objects with directional shadow mapping.
   */
  opaqueShadow?: DrawOp;

  /**
   * Draw operation that renders opaque objects with BOTH SAO and shadow mapping
   * applied in a single pass.
   */
  opaqueSAOShadow?: DrawOp;

  /**
   * Draw operation for rendering opaque edges.
   */
  opaqueEdges?: DrawOp;

  /**
   * Thick (quad-expanded) variant of {@link opaqueEdges}, used when
   * `View.effects.edges.edgeWidth > 1` (wide edges, since `gl.lineWidth`
   * can't thicken `gl.LINES` on most WebGL stacks).
   */
  opaqueEdgesThick?: DrawOp;

  /**
   * Unlit pure-colour opaque draw operation. The fragment colour comes
   * straight from the mesh's stored colour — no Lambert / PBR, no SAO,
   * no shadow. Used by the renderer's overlay-bin pass so gizmo handles,
   * HUD chrome, and other "floating UI" content render as solid colour
   * over the lit scene behind them instead of darkening on faces angled
   * away from the lights.
   */
  flatColor?: DrawOp;

  /**
   * Transparent variant of {@link flatColor} — same unlit shader, run
   * in the TRANSPARENT pass so translucent overlay meshes (e.g. the
   * plane handles on a transform gizmo) blend correctly.
   */
  flatColorTransparent?: DrawOp;

  /**
   * Draw operation for rendering transparent objects.
   */
  transparent?: DrawOp;

  /**
   * Draw operation for rendering transparent edges.
   */
  transparentEdges?: DrawOp;

  /**
   * Thick (quad-expanded) variant of {@link transparentEdges}, used when
   * `View.effects.edges.edgeWidth > 1`.
   */
  transparentEdgesThick?: DrawOp;

  /**
   * Draw operation for rendering highlighted silhouettes.
   */
  highlighted?: DrawOp;

  /**
   * Draw operation for rendering selected silhouettes.
   */
  selected?: DrawOp;

  /**
   * Draw operation for rendering x-rayed silhouettes.
   */
  xrayed?: DrawOp;

  /**
   * Draw operation for rendering highlighted silhouette edges.
   */
  highlightedEdges?: DrawOp;

  /**
   * Draw operation for rendering selected silhouette edges.
   */
  selectedEdges?: DrawOp;

  /**
   * Draw operation for rendering x-rayed silhouette edges.
   */
  xrayedEdges?: DrawOp;

  /**
   * Draw operation for mesh picking (renders mesh IDs to pick buffer).
   */
  pick?: DrawOp;

  /**
   * Draw operation for depth picking (renders screen-space depths).
   */
  pickDepth?: DrawOp;

  /**
   * Stencil-mask draw operation — used by the section-plane cap
   * pass. Re-rasterises the model with no colour / depth writes,
   * letting RenderManager's stencil-op state stamp a per-pixel
   * count of "model crosses the cap plane here". Iterated twice
   * per cap-enabled plane (front-cull DECR, back-cull INCR);
   * the cap quad reads the resulting stencil mask.
   */
  stencilMask?: DrawOp;

  /**
   * Snap-init draw operation — rasterises triangle surfaces into the
   * snap FBO (depth + view position) so subsequent vertex / edge snap
   * draws z-test against real geometry.
   */
  snapInit?: DrawOp;

  /**
   * Vertex-snap draw operation — every unique vertex of the geometry
   * is drawn as a 1-pixel `gl.POINTS`, view-space position written into
   * the snap FBO at fragments that survive the init pass's depth test.
   */
  snapVertex?: DrawOp;

  /**
   * Edge-snap draw operation — the geometry's edge-index buffer is
   * drawn as `gl.LINES`, view-space position written into the snap FBO
   * at fragments that survive the init pass's depth test.
   */
  snapEdge?: DrawOp;
}
