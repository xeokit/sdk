import type {View} from "../../viewer";
import type {NavCubeParams} from "./NavCubeParams";

/**
 * NavCube — a small 3D cube widget that reflects the {@link View |
 * View}'s camera orientation and lets the user fly the camera to
 * any canonical axis-aligned, corner, or edge view by clicking the
 * corresponding region of the cube.
 *
 * Mirrors the shape of V2's `NavCubePlugin` but rendered with
 * CSS 3D transforms — no second renderer or off-screen canvas is
 * required, and the widget composes naturally with whatever
 * overlay chrome an example already has.
 *
 * The cube's local axes are fixed: `+X` is RIGHT, `+Y` is FRONT,
 * `+Z` is TOP (CAD / BIM convention). For Y-up scenes a `+90°`
 * rotation about X is folded into the view matrix so the +Y face
 * still appears at the top.
 *
 * ### Interaction
 *
 * | Region of cube         | View flown to                     |
 * | ---------------------- | --------------------------------- |
 * | Face                   | Axis-aligned (front / right / …)  |
 * | Edge between two faces | Diagonal between those two axes   |
 * | Corner                 | Three-axis isometric corner view  |
 *
 * Each region highlights on hover.
 *
 * ### Sync
 *
 * Subscribes to `view.viewer.events.onCameraViewMatrixUpdated` and
 * recomputes the cube's CSS rotation each tick. Camera changes
 * driven by anything (orbit, drag, `flyTo`, programmatic) keep the
 * cube in sync.
 *
 * ### Lifecycle
 *
 * `destroy()` removes the DOM, unsubscribes, and is idempotent.
 */
export class NavCube {

  /**
   * Per-View instance registry. WeakMap so a View that gets
   * destroyed elsewhere doesn't keep this NavCube alive for GC.
   */
  private static readonly _instances = new WeakMap<View, NavCube>();

  /**
   * SVG glyph used in context-menu rows that toggle this widget.
   * A small isometric cube — strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M12 3 L21 7.5 L21 16.5 L12 21 L3 16.5 L3 7.5 Z" ` +
        `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M3 7.5 L12 12 L21 7.5 M12 12 L12 21" ` +
        `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
    `</svg>`;
  }

  /**
   * Returns the live NavCube bound to {@link view}, or `undefined`
   * if none has been created yet (or the previous one was destroyed).
   */
  static getFor(view: View): NavCube | undefined {
    const inst = NavCube._instances.get(view);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Idempotent factory: returns the existing NavCube for
   * {@link NavCubeParams.view}, or constructs one. If an existing
   * instance is hidden it's shown again.
   */
  static openFor(params: NavCubeParams): NavCube {
    let inst = NavCube._instances.get(params.view);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new NavCube(params);
    return inst;
  }

  private readonly _view: any;
  private readonly _flight: any | null;
  private readonly _zUp: boolean;
  private readonly _size: number;
  private readonly _cameraFly: boolean;
  private readonly _cameraFitFOV: number;
  private readonly _cameraFlyDuration: number;

  private readonly _root: HTMLDivElement;
  private readonly _stage: HTMLDivElement;
  private readonly _cube: HTMLDivElement;
  private readonly _regions: HTMLDivElement[];

  private _unsub: (() => void) | null;
  private _destroyed = false;

  constructor(params: NavCubeParams) {
    const view = params.view as any;
    if (!view) {
      throw new Error("[NavCube] params.view is required");
    }

    this._view = view;
    this._flight = params.cameraFlight ?? null;
    this._size = params.size ?? 80;
    this._cameraFly = params.cameraFly !== false && !!this._flight;
    this._cameraFitFOV = params.cameraFitFOV ?? 45;
    this._cameraFlyDuration = params.cameraFlyDuration ?? 0.5;

    if (typeof params.zUp === "boolean") {
      this._zUp = params.zUp;
    } else {
      const wu = view.viewer?.scene?.coordinateSystem?.worldUp;
      this._zUp = !!wu && Math.abs(wu[2] ?? 0) > Math.abs(wu[1] ?? 0);
    }

    const container: HTMLElement =
      params.container
      ?? (view.htmlElement?.parentElement as HTMLElement)
      ?? document.body;

    // Anchor: bottom-right by default (the AEC convention —
    // Revit, Navisworks, BIM 360 all dock the view-cube widget
    // bottom-right). An explicit `top` override flips the
    // vertical anchor. The default `bottom: 56` clears the
    // floating-panel pill row at `bottom: 17` (~30 px tall) so
    // a closed Distance/Angle/Views panel pill does not obscure
    // the cube.
    const right = params.right ?? 12;
    const useTop = typeof params.top === "number";
    const top    = useTop ? (params.top as number) : 0;
    const bottom = params.bottom ?? 56;

    // ── Root + stage + cube DOM ──────────────────────────────
    this._root = document.createElement("div");
    const rootStyle: Record<string, string> = {
      position:         "absolute",
      right:            `${right}px`,
      width:            `${this._size}px`,
      height:           `${this._size}px`,
      pointerEvents:    "none",
      userSelect:       "none",
      // Above the floating-panel pill row (zIndex 200_000_000)
      // so a closed-panel pill does not obscure the cube.
      zIndex:           "200000001",
      display:          (params.visible !== false) ? "block" : "none",
    };
    if (useTop) rootStyle.top    = `${top}px`;
    else        rootStyle.bottom = `${bottom}px`;
    Object.assign(this._root.style, rootStyle);

    this._stage = document.createElement("div");
    Object.assign(this._stage.style, {
      position:         "absolute",
      inset:            "0",
      perspective:      `${this._size * 4}px`,
      perspectiveOrigin: "50% 50%",
    });
    this._root.appendChild(this._stage);

    this._cube = document.createElement("div");
    Object.assign(this._cube.style, {
      position:         "absolute",
      inset:            "0",
      transformStyle:   "preserve-3d",
      transform:        "rotateX(0deg) rotateY(0deg)",
      pointerEvents:    "auto",
      cursor:           "pointer",
    });
    this._stage.appendChild(this._cube);

    this._regions = [];
    this._buildFaces();
    this._buildEdgesAndCorners();

    container.appendChild(this._root);

    // ── Camera sync ──────────────────────────────────────────
    const events = view.viewer?.events;
    if (events?.onCameraViewMatrixUpdated?.subscribe) {
      this._unsub = events.onCameraViewMatrixUpdated.subscribe(() => this._sync());
    } else {
      this._unsub = null;
    }
    this._sync();

    // Replace any prior NavCube bound to the same View.
    const prior = NavCube._instances.get(view);
    if (prior && prior !== this && !prior._destroyed) prior.destroy();
    NavCube._instances.set(view, this);
  }

  /** True when the widget is currently mounted and visible. */
  get visible(): boolean {
    return !this._destroyed && this._root.style.display !== "none";
  }

  /** True once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Show or hide the NavCube. Prefer {@link show} / {@link hide}
   * for new code; this stays for back-compat with the original
   * single-method API.
   */
  setVisible(visible: boolean): void {
    if (this._destroyed) return;
    this._root.style.display = visible ? "block" : "none";
  }

  /** Show the cube. No-op if already visible or destroyed. */
  show(): void {
    this.setVisible(true);
  }

  /** Hide the cube without tearing down its DOM or subscription. */
  hide(): void {
    this.setVisible(false);
  }

  /** Flip visibility. Returns the new visible state. */
  toggle(): boolean {
    const next = !this.visible;
    this.setVisible(next);
    return next;
  }

  /**
   * Tear down the NavCube. Idempotent.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._unsub) {
      try { this._unsub(); } catch { /* ignore */ }
      this._unsub = null;
    }
    this._root.parentNode?.removeChild(this._root);
    if (NavCube._instances.get(this._view) === this) {
      NavCube._instances.delete(this._view);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DOM construction
  // ─────────────────────────────────────────────────────────────

  /**
   * Builds the 6 face panels of the cube. Each face has its label
   * (FRONT, BACK, etc.) and a click handler that flies the camera
   * to that axis-aligned view.
   *
   * Local cube axes (cube frame, matching {@link _sync}'s matrix3d):
   * +X = right (RIGHT face), +Y = front (FRONT face), +Z = top
   * (TOP face). CSS X/Y/Z inside the cube DOM map directly to world
   * X/Y/Z; the sync matrix handles the world→screen rotation.
   *
   * Why each face has a {@code <span>} child with {@code scaleX(-1)}:
   * CSS uses Y-down for text layout but the cube lives in a Z-up
   * world, so the rotation that places a face with its outward
   * normal facing the canonical-view camera also reflects text
   * across the screen-X axis (letters appear mirrored, word reads
   * right-to-left). Pre-flipping the label content cancels that
   * reflection without disturbing the face's own determinant — so
   * `backface-visibility: hidden` still culls correctly.
   */
  private _buildFaces(): void {
    const half = this._size / 2;

    // [name, faceTransform, dirInCubeFrame]
    // dir is the camera-forward direction the click flies to:
    // eye = center − dir·dist, so dir = (0,−1,0) places the camera
    // on the +Y side, looking back at the +Y (FRONT) face.
    const faces: Array<[string, string, [number, number, number]]> = [
      ["RIGHT",  `translateX(${ half}px) rotateY( 90deg) rotateZ(-90deg)`, [-1,  0,  0]],
      ["LEFT",   `translateX(${-half}px) rotateY(-90deg) rotateZ( 90deg)`, [ 1,  0,  0]],
      ["FRONT",  `translateY(${ half}px) rotateX(-90deg)`,                  [ 0, -1,  0]],
      ["BACK",   `translateY(${-half}px) rotateX( 90deg) rotateZ(180deg)`, [ 0,  1,  0]],
      ["TOP",    `translateZ(${ half}px) rotateZ(180deg)`,                  [ 0,  0, -1]],
      ["BOTTOM", `translateZ(${-half}px) rotateY(180deg) rotateZ(180deg)`,  [ 0,  0,  1]],
    ];

    for (const [label, transform, dir] of faces) {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position:        "absolute",
        width:           `${this._size}px`,
        height:          `${this._size}px`,
        transform,
        backfaceVisibility: "hidden",
        background:      "rgba(245, 245, 245, 0.95)",
        border:          "1px solid rgba(0, 0, 0, 0.35)",
        boxSizing:       "border-box",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        fontFamily:      'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize:        `${Math.round(this._size * 0.18)}px`,
        fontWeight:      "600",
        letterSpacing:   "1px",
        color:           "#333",
        textShadow:      "0 1px 0 rgba(255,255,255,0.6)",
        cursor:          "pointer",
        transition:      "background 80ms ease",
      });

      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      labelEl.style.display = "inline-block";
      labelEl.style.transform = "scaleX(-1)";
      el.appendChild(labelEl);

      this._wireRegion(el, dir);
      this._cube.appendChild(el);
    }
  }

  /**
   * Builds the 12 edges and 8 corners of the cube as small
   * transparent click targets. Edges fly to a 2-axis diagonal
   * view; corners to a 3-axis isometric view.
   *
   * Each click region sits flush against a face plane just inside
   * the cube edge, so face clicks still register up to the very
   * corner — only the {@code t}-pixel rim along each edge / corner
   * goes to the diagonal targets.
   */
  private _buildEdgesAndCorners(): void {
    const half = this._size / 2;
    const t = Math.max(8, Math.round(this._size * 0.12));   // edge / corner thickness
    const inner = this._size - 2 * t;                       // length of the central section of an edge

    // Helper: given two unit face-normal directions, return the
    // unit camera-forward direction the diagonal click flies to.
    const edgeDir = (a: [number, number, number], b: [number, number, number]): [number, number, number] => {
      const v: [number, number, number] = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
      const n = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / n, v[1] / n, v[2] / n];
    };

    // Helper: the face-NORMAL direction for each face (NOT the
    // camera-forward direction — opposite sign). e.g. RIGHT face's
    // outward normal is +X but its click `dir` is −X.
    // We use normals here to compose corner / edge `dir`s.
    const NX: [number, number, number] = [ 1, 0, 0];
    const NXN: [number, number, number] = [-1, 0, 0];
    const NY: [number, number, number] = [ 0, 1, 0];
    const NYN: [number, number, number] = [ 0,-1, 0];
    const NZ: [number, number, number] = [ 0, 0, 1];
    const NZN: [number, number, number] = [ 0, 0,-1];

    // ── Edges: 12 thin rectangles, each lying flush against one of
    //    the two faces that meet at that edge. Centered between
    //    the two corners along the edge axis. Built with a
    //    `translate(-50%,-50%)` prefix so `translate3d(cx,cy,cz)`
    //    places the rectangle's CENTER at cube-local (cx,cy,cz).

    type EdgeSpec = {
      /** Outward normals of the two faces that meet at this edge. */
      a: [number, number, number]; b: [number, number, number];
      /** Cube-local center of the click rectangle. */
      cx: number; cy: number; cz: number;
      /** Element width × height (CSS pre-rotation). */
      width: number; height: number;
      /** Rotation that aligns element +Z with face A's normal and
       *  element +Y along the edge axis. */
      rot: string;
    };
    const edges: EdgeSpec[] = [
      // Edges along cube Z (vertical pillars between TOP and BOTTOM).
      // Hosted on FRONT (+Y) or BACK (−Y) plane; rotateX(±90°)
      // tips element +Z into ±Y and lays element +Y down along ±Z.
      { a: NY,  b: NX,  cx:  half - t/2, cy:  half,        cz: 0, width: t, height: inner, rot: "rotateX(-90deg)" },
      { a: NY,  b: NXN, cx: -half + t/2, cy:  half,        cz: 0, width: t, height: inner, rot: "rotateX(-90deg)" },
      { a: NYN, b: NX,  cx:  half - t/2, cy: -half,        cz: 0, width: t, height: inner, rot: "rotateX( 90deg)" },
      { a: NYN, b: NXN, cx: -half + t/2, cy: -half,        cz: 0, width: t, height: inner, rot: "rotateX( 90deg)" },

      // Edges along cube Y (between FRONT and BACK).
      // Hosted on TOP (+Z) or BOTTOM (−Z) plane.
      // TOP: identity rotation already gives e+Z=+Z, e+Y=+Y.
      // BOTTOM: rotateY(180°) flips to −Z normal.
      { a: NZ,  b: NX,  cx:  half - t/2, cy: 0, cz:  half,        width: t, height: inner, rot: "" },
      { a: NZ,  b: NXN, cx: -half + t/2, cy: 0, cz:  half,        width: t, height: inner, rot: "" },
      { a: NZN, b: NX,  cx:  half - t/2, cy: 0, cz: -half,        width: t, height: inner, rot: "rotateY(180deg)" },
      { a: NZN, b: NXN, cx: -half + t/2, cy: 0, cz: -half,        width: t, height: inner, rot: "rotateY(180deg)" },

      // Edges along cube X (between LEFT and RIGHT).
      // Hosted on TOP / BOTTOM; rotateZ(90°) makes element +Y
      // (height) point along ∓X (the edge axis).
      { a: NZ,  b: NY,  cx: 0, cy:  half - t/2, cz:  half,        width: t, height: inner, rot: "rotateZ( 90deg)" },
      { a: NZ,  b: NYN, cx: 0, cy: -half + t/2, cz:  half,        width: t, height: inner, rot: "rotateZ( 90deg)" },
      { a: NZN, b: NY,  cx: 0, cy:  half - t/2, cz: -half,        width: t, height: inner, rot: "rotateY(180deg) rotateZ( 90deg)" },
      { a: NZN, b: NYN, cx: 0, cy: -half + t/2, cz: -half,        width: t, height: inner, rot: "rotateY(180deg) rotateZ( 90deg)" },
    ];

    for (const spec of edges) {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position:       "absolute",
        left:           "50%",
        top:            "50%",
        width:          `${spec.width}px`,
        height:         `${spec.height}px`,
        transform:      `translate(-50%, -50%) translate3d(${spec.cx}px, ${spec.cy}px, ${spec.cz}px) ${spec.rot}`,
        background:     "rgba(0, 0, 0, 0)",
        boxSizing:      "border-box",
        cursor:         "pointer",
        transition:     "background 80ms ease",
      });
      // Camera flies *away from* both face normals — opposite sign.
      const dir = edgeDir(spec.a, spec.b);
      this._wireRegion(el, [-dir[0], -dir[1], -dir[2]]);
      this._cube.appendChild(el);
    }

    // ── Corners: 8 small flat squares at the cube vertices, hosted
    //    on the TOP or BOTTOM face plane (whichever the corner
    //    touches). The corner is positioned at the cube vertex,
    //    inset by t/2 in the X and Y directions so it sits on the
    //    face surface, not poking past it.
    const cornerSigns: Array<[number, number, number]> = [
      [-1, -1, -1], [ 1, -1, -1], [-1,  1, -1], [ 1,  1, -1],
      [-1, -1,  1], [ 1, -1,  1], [-1,  1,  1], [ 1,  1,  1],
    ];
    for (const [sx, sy, sz] of cornerSigns) {
      const el = document.createElement("div");
      const cx = sx * (half - t / 2);
      const cy = sy * (half - t / 2);
      const cz = sz * half;
      // Face normals of the three faces meeting at this corner.
      // Camera-forward direction = −(sum of normals) / ||·||.
      const sum: [number, number, number] = [sx, sy, sz];
      const nrm = Math.hypot(sum[0], sum[1], sum[2]) || 1;
      const dir: [number, number, number] = [-sum[0] / nrm, -sum[1] / nrm, -sum[2] / nrm];

      Object.assign(el.style, {
        position:    "absolute",
        left:        "50%",
        top:         "50%",
        width:       `${t}px`,
        height:      `${t}px`,
        transform:   `translate(-50%, -50%) translate3d(${cx}px, ${cy}px, ${cz}px)${sz < 0 ? " rotateY(180deg)" : ""}`,
        background:  "rgba(0, 0, 0, 0)",
        cursor:      "pointer",
        transition:  "background 80ms ease",
      });
      this._wireRegion(el, dir);
      this._cube.appendChild(el);
    }
  }

  /**
   * Wire hover highlight + click-to-fly behaviour onto a region
   * div (face / edge / corner). `dir` is the camera-forward
   * direction in cube-local coordinates that the region targets.
   */
  private _wireRegion(el: HTMLDivElement, dir: [number, number, number]): void {
    el.addEventListener("pointerenter", () => {
      el.style.background = "rgba(80, 120, 180, 0.45)";
    });
    el.addEventListener("pointerleave", () => {
      el.style.background = "rgba(0, 0, 0, 0)";
    });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this._navigateTo(dir);
    });
    this._regions.push(el);
  }

  // ─────────────────────────────────────────────────────────────
  // Camera sync + navigation
  // ─────────────────────────────────────────────────────────────

  /**
   * Maps the View camera's orientation onto the cube's CSS
   * rotation so the cube faces appear in the same screen
   * directions as the world axes they represent.
   */
  private _sync(): void {
    if (this._destroyed) return;

    const cam = this._view.camera;
    if (!cam) return;

    const eye  = cam.eye  as readonly [number, number, number];
    const look = cam.look as readonly [number, number, number];
    const up   = cam.up   as readonly [number, number, number];

    // World-space camera basis (orthonormal): forward = look - eye,
    // right = forward × up, up = right × forward.
    const fwd = norm3([look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]]);
    const r   = norm3(cross3(fwd, up));
    const u   = cross3(r, fwd);   // already unit since r and fwd are unit and orthogonal

    // Rotation from world space to "cube-local-as-shown-in-screen".
    // Cube-local axes: +X = right (cube screen +X), +Y = front
    // (cube screen +Z, into back-of-screen), +Z = top (cube screen
    // +Y, up). We pre-multiply by Rcube_from_world so that:
    //   world_X (or whatever's right in the View) → cube +X (RIGHT face)
    //   world_Y (forward in the View) → cube +Y (FRONT face)
    //   world_Z (up in the View)      → cube +Z (TOP face)
    //
    // For a Y-up View, the "world up" the camera reports is
    // actually world +Y, so we re-label: cube +Z gets the View's
    // +Y axis. The math below handles either by reading the
    // camera's own up vector.
    //
    // Build the rotation that, applied to the cube, reproduces
    // what the camera sees: it's the camera's view rotation with
    // CSS-screen Y-axis flipped (CSS Y is screen-down; graphics
    // Y is screen-up).
    //
    // Camera view rotation rows: [r, u, -fwd]. CSS screen rows
    // for the cube's transform are [r, -u, -fwd] — that's the
    // matrix3d below.
    //
    // Note we pass the world axes as the SOURCE basis. CSS
    // matrix3d is column-major: each column is the image of
    // (1,0,0), (0,1,0), (0,0,1) in screen space.

    const m = (this._zUp
      // Z-up world: world axes (X,Y,Z) map to cube local
      // (right, front, up) directly.
      ? [
          r[0],     -u[0],    -fwd[0],
          r[1],     -u[1],    -fwd[1],
          r[2],     -u[2],    -fwd[2],
        ]
      // Y-up world: rotate world axes 90° about X first so
      // world +Y becomes cube +Z (TOP). Equivalent to swapping
      // rows 2 and 3 of the source basis.
      : [
          r[0],     -u[0],    -fwd[0],
          r[2],     -u[2],    -fwd[2],
          -r[1],    u[1],     fwd[1],
        ]);

    this._cube.style.transform =
      `matrix3d(${m[0]}, ${m[1]}, ${m[2]}, 0, ${m[3]}, ${m[4]}, ${m[5]}, 0, ${m[6]}, ${m[7]}, ${m[8]}, 0, 0, 0, 0, 1)`;
  }

  /**
   * Fly the View's camera to a canonical view, given the target
   * camera-forward direction in *cube-local* coordinates.
   */
  private _navigateTo(cubeDir: [number, number, number]): void {
    const cam = this._view.camera;
    const scene = this._view.viewer?.scene;
    if (!cam) return;

    // Cube-local → world: invert the same axis remap _sync uses.
    const worldDir: [number, number, number] = this._zUp
      ? [cubeDir[0], cubeDir[1], cubeDir[2]]
      : [cubeDir[0], -cubeDir[2], cubeDir[1]];

    const aabb: [number, number, number, number, number, number] | null
      = (scene as any)?.aabb ?? null;
    const center: [number, number, number] = aabb
      ? [(aabb[0] + aabb[3]) / 2, (aabb[1] + aabb[4]) / 2, (aabb[2] + aabb[5]) / 2]
      : (cam.look ?? [0, 0, 0]);

    const diag = aabb ? aabb3Diag(aabb) : 10;
    const dist = Math.abs(diag / Math.tan(this._cameraFitFOV * Math.PI / 180));

    // Place eye opposite to the camera-forward direction.
    const eye: [number, number, number] = [
      center[0] - worldDir[0] * dist,
      center[1] - worldDir[1] * dist,
      center[2] - worldDir[2] * dist,
    ];

    // Pick an "up" that's perpendicular to the new forward and
    // aligned with the world up axis. If the new forward is
    // collinear with world-up (looking straight down or up), fall
    // back to a stable secondary axis.
    const worldUp: [number, number, number] = this._zUp ? [0, 0, 1] : [0, 1, 0];
    let up: [number, number, number];
    const dotFU = Math.abs(dot3(worldDir, worldUp));
    if (dotFU > 0.999) {
      // Looking nearly along world-up — pick a side axis.
      up = this._zUp ? [0, 1, 0] : [0, 0, -1];
    } else {
      // Project worldUp onto plane perpendicular to worldDir.
      const proj: [number, number, number] = [
        worldUp[0] - worldDir[0] * dotFU,
        worldUp[1] - worldDir[1] * dotFU,
        worldUp[2] - worldDir[2] * dotFU,
      ];
      up = norm3(proj);
    }

    const flyParams = { eye, look: center, up, fitFOV: this._cameraFitFOV, duration: this._cameraFlyDuration };

    if (this._cameraFly && this._flight?.flyTo) {
      this._flight.flyTo(flyParams);
    } else if (this._flight?.jumpTo) {
      this._flight.jumpTo(flyParams);
    } else {
      cam.eye  = eye;
      cam.look = center;
      cam.up   = up;
    }
  }
}


// ─────────────────────────────────────────────────────────────
// Tiny vec3 helpers — kept local so the demo helper stays
// self-contained and tree-shakeable.
// ─────────────────────────────────────────────────────────────

function norm3(v: [number, number, number]): [number, number, number] {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

function cross3(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function aabb3Diag(aabb: readonly [number, number, number, number, number, number]): number {
  const dx = aabb[3] - aabb[0];
  const dy = aabb[4] - aabb[1];
  const dz = aabb[5] - aabb[2];
  return Math.hypot(dx, dy, dz);
}
