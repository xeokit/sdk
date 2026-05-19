/**
 * Base class for the floating demo panels (`SceneHealthPanel`,
 * `DataHealthPanel`, `SceneStatsPanel`, `DataStatsPanel`,
 * `BoundariesPanel`, `TilesPanel`, `IssuesPanel`,
 * `ExplorerPanel`, `GPUMemoryPanel`, `ViewerConfigPanel`,
 * `SchemaMaterialsPanel`, `SampleModelsPanel`, `ExportDialog`,
 * `Toolbar`).
 *
 * Owns the chrome that every panel had reimplemented byte-for-byte:
 *
 *   - `_panel` / `_pill` / `_header` / `_closeBtn` DOM refs
 *     (subclass populates in `_buildDom`, base appends to the
 *     container).
 *   - Pointer drag with edge + inter-panel snap
 *     (via {@link snapToEdges}).
 *   - Layout persistence to `localStorage` (key supplied per
 *     subclass) — `_restoreLayout` / `_saveLayout` /
 *     `_clampToViewport`.
 *   - Show / hide / toggle / destroy lifecycle, including the
 *     panel ↔ pill swap, `bringFloatingPanelToFront` on show /
 *     pointer-down, and snap-registry register / unregister.
 *   - Window-resize listener that re-clamps on viewport change.
 *
 * Subclass contract:
 *
 *   1. Constructor calls `super({...})` with `storageKey` and
 *      `classPrefix`, then implements its own DOM construction.
 *   2. Implements `_buildDom()` — populates `_panel`, `_pill`,
 *      `_header`, `_closeBtn`, and appends both `_panel` and
 *      `_pill` to `this._container`.
 *   3. Calls `this._bindChrome()` after `_buildDom()` to wire
 *      the drag / close / pill / resize listeners.
 *   4. Overrides `show()` / `hide()` / `destroy()` if it needs
 *      additional behaviour, calling `super.X()` to hand back
 *      to the base.
 *
 * The base owns no per-subclass state beyond the four DOM refs;
 * each subclass keeps its own static `_instances` registry,
 * scene / data references, and panel-content rendering.
 *
 * @module demo/floatingPanelBase
 */
import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter} from "../../base/core";
import {bringFloatingPanelToFront} from "./floatingPanelZ";
import {registerPill, unregisterPill} from "./floatingPanelPillRail";
import {
  registerFloatingPanel,
  snapToEdges,
  unregisterFloatingPanel,
} from "./floatingPanelSnap";
import {showBackdrop, hideBackdrop, syncBackdropZ} from "./modalBackdrop";


export interface FloatingPanelBaseParams {

  /** DOM container for the panel + pill. Defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for the panel's drag-position + closed
   * state. Each subclass picks a unique value (e.g.
   * `"xkt-sh-panel"`) so two different panels don't share a slot.
   */
  storageKey: string;

  /**
   * CSS class-name prefix used by the subclass's stylesheet
   * (e.g. `"xkt-sh"`). The base only uses it to compose the
   * `${prefix}-dragging` class added to `_header` while a drag
   * is in flight.
   */
  classPrefix: string;

  /**
   * When `true`, the panel renders as a centered modal: a
   * translucent backdrop sits behind the panel while it's
   * visible, intercepts pointer events from anything else, and
   * dismisses the panel on click or `Escape`. Subclass owns the
   * centering CSS (`top: 50%; left: 50%; transform: translate(-50%, -50%)`).
   */
  modal?: boolean;

  /**
   * When `true` (the default), eight invisible drag handles
   * (4 edges + 4 corners) are injected into `_panel` and the
   * user can resize it. Resize is suppressed when {@link modal}
   * is `true`. Panels that wrap a fixed-size child (NavCube)
   * or whose internal layout doesn't tolerate width changes
   * (Toolbar) opt out by passing `false`.
   */
  resizable?: boolean;

  /** Minimum width the resize handles will allow, in CSS pixels. Default 280. */
  minWidth?: number;

  /** Minimum height the resize handles will allow, in CSS pixels. Default 200. */
  minHeight?: number;
}


/**
 * Abstract base for every floating demo panel. Subclasses build
 * their DOM in `_buildDom()`, then call `_bindChrome()` to
 * activate drag / pill / persistence behaviour.
 */
export abstract class FloatingPanelBase {

  /** Root panel element. Populated by subclass in `_buildDom()`. */
  protected _panel!: HTMLElement;

  /** Floating "reopen" pill shown while the panel is hidden. */
  protected _pill!: HTMLElement;

  /** Drag handle inside the panel — usually the title row. */
  protected _header!: HTMLElement;

  /** Close button (clicked → `hide()`, surfaces the pill). */
  protected _closeBtn!: HTMLButtonElement;

  /** Fires when `show()` / `hide()` toggles the panel's visibility. */
  readonly onVisibilityChanged = new EventEmitter<FloatingPanelBase, boolean>(
    new EventDispatcher<FloatingPanelBase, boolean>(),
  );

  /**
   * Fires while the user drags the panel (one notification per
   * `pointermove` during a drag) and once when the drag ends.
   *
   * Drag changes the panel's CSS `left` / `top` but never its
   * size, so a `ResizeObserver` on any descendant element never
   * sees it. Subclasses or hosts that need to track the panel's
   * viewport position — for example a {@link viewing!viewer.View | View}
   * embedded in the body whose shared WebGL canvas must follow
   * the panel — should subscribe to this and re-read the
   * panel's bounding rect.
   */
  readonly onLayoutChanged = new EventEmitter<FloatingPanelBase, void>(
    new EventDispatcher<FloatingPanelBase, void>(),
  );

  protected readonly _container: HTMLElement;
  protected readonly _storageKey: string;
  protected readonly _classPrefix: string;
  protected readonly _modal: boolean;
  protected readonly _resizable: boolean;
  protected readonly _minWidth: number;
  protected readonly _minHeight: number;
  protected _destroyed = false;

  private _dragging = false;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;
  private _chromeBound = false;
  private _backdrop: HTMLElement | null = null;

  private readonly _onResize = (): void => {
    this._clampToViewport();
    this._saveLayout();
    // Window resize can shift the panel without resizing it (the
    // clamp logic moves it back into the viewport). Treat that
    // the same as a drag: fire the layout-change notification so
    // hosts can re-align contents that depend on the panel's
    // viewport position.
    this.onLayoutChanged.dispatch(this, undefined);
  };

  private readonly _onModalKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape" && this.visible) this.hide();
  };

  protected constructor(params: FloatingPanelBaseParams) {
    this._container = params.container || document.body;
    this._storageKey = params.storageKey;
    this._classPrefix = params.classPrefix;
    this._modal = params.modal === true;
    this._resizable = params.resizable !== false && !this._modal;
    this._minWidth  = params.minWidth  ?? 280;
    this._minHeight = params.minHeight ?? 200;
  }


  // ── Subclass hook ─────────────────────────────────────────────

  /**
   * Subclass populates `_panel`, `_pill`, `_header`, `_closeBtn`
   * here, and appends `_panel` + `_pill` to `_container`. Called
   * exactly once, before {@link _bindChrome}.
   */
  protected abstract _buildDom(): void;


  // ── Chrome wiring ─────────────────────────────────────────────

  /**
   * Wire the shared chrome behaviour onto the DOM the subclass
   * built. Idempotent — calling twice is a no-op.
   */
  protected _bindChrome(): void {
    if (this._chromeBound) return;
    this._chromeBound = true;

    registerFloatingPanel(this._panel);
    // Modal panels never surface a reopen pill — they're
    // dismissed via ✕ / ESC / backdrop and re-opened from the
    // toolbar or menu that owns them.
    if (!this._modal) registerPill(this._pill, this._container);

    this._panel.addEventListener("pointerdown", () => {
      bringFloatingPanelToFront(this._panel, this._modal);
    });

    this._closeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.hide();
    });
    this._pill.addEventListener("click", () => this.show());

    const draggingClass = `${this._classPrefix}-dragging`;

    this._header.addEventListener("pointerdown", (ev) => {
      if ((ev.target as Element).closest("button")) return;
      if (ev.button !== 0) return;
      const rect = this._panel.getBoundingClientRect();
      this._dragOffsetX = ev.clientX - rect.left;
      this._dragOffsetY = ev.clientY - rect.top;
      this._panel.style.right     = "auto";
      this._panel.style.left      = rect.left + "px";
      this._panel.style.top       = rect.top  + "px";
      // Defeat any centering / sliding transform the panel's
      // initial CSS used so subsequent left/top writes actually
      // move the element (ExportDialog centers via translate(-50%,-50%)).
      this._panel.style.transform = "none";
      this._dragging = true;
      this._header.classList.add(draggingClass);
      this._header.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    this._header.addEventListener("pointermove", (ev) => {
      if (!this._dragging) return;
      const rect = this._panel.getBoundingClientRect();
      const snapped = snapToEdges(
        ev.clientX - this._dragOffsetX,
        ev.clientY - this._dragOffsetY,
        rect.width, rect.height,
        this._panel,
      );
      this._panel.style.left = snapped.left + "px";
      this._panel.style.top  = snapped.top  + "px";
      // Drag only moves the panel — no descendant resizes — so
      // ResizeObserver-based listeners would miss this. Fire
      // `onLayoutChanged` so hosts can re-align contents whose
      // viewport position depends on the panel.
      this.onLayoutChanged.dispatch(this, undefined);
    });
    const endDrag = (ev: PointerEvent): void => {
      if (!this._dragging) return;
      this._dragging = false;
      this._header.classList.remove(draggingClass);
      try { this._header.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      this._saveLayout();
      this.onLayoutChanged.dispatch(this, undefined);
    };
    this._header.addEventListener("pointerup",     endDrag);
    this._header.addEventListener("pointercancel", endDrag);

    if (this._resizable) this._bindResize();

    window.addEventListener("resize", this._onResize);
    // Modals always centre themselves on show; persisting a
    // dragged position would fight that on the next open.
    if (!this._modal) this._restoreLayout();
  }


  // ── Resize handles ────────────────────────────────────────────

  /**
   * Inject eight invisible drag handles (4 edges + 4 corners)
   * into `_panel` and wire pointer events. Each handle pins the
   * panel to absolute `left` / `top` on pointerdown (so subsequent
   * size + position writes take effect over any CSS that uses
   * `right` / `bottom`), then writes new `width` / `height` —
   * and, for north / west edges, new `left` / `top` — on
   * pointermove. `onLayoutChanged` fires per move and at drag-end;
   * the saved layout is updated on drag-end.
   *
   * `min-width` / `min-height` enforced from `_minWidth` /
   * `_minHeight`; `max-width` / `max-height` are released by
   * setting them to `"none"` inline so user-driven size is not
   * clipped by CSS bounds like `max-height: calc(100vh - 32px)`.
   */
  protected _bindResize(): void {
    // Enforce minimums so handles can't crush the panel to nothing.
    this._panel.style.minWidth  = `${this._minWidth}px`;
    this._panel.style.minHeight = `${this._minHeight}px`;

    const EDGE   = 5;   // edge-handle thickness, px
    const CORNER = 8;   // corner-handle square, px
    const positions: Array<"n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"> =
      ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    const cursorFor: Record<string, string> = {
      n:  "ns-resize", s:  "ns-resize",
      e:  "ew-resize", w:  "ew-resize",
      ne: "nesw-resize", sw: "nesw-resize",
      nw: "nwse-resize", se: "nwse-resize",
    };

    for (const pos of positions) {
      const handle = document.createElement("div");
      handle.setAttribute("data-resize-handle", pos);
      const s = handle.style;
      s.position    = "absolute";
      s.background  = "transparent";
      s.cursor      = cursorFor[pos];
      s.touchAction = "none";
      s.zIndex      = "2";

      // Edge handles run the full length of the panel minus the
      // corner zones, so corners always win on the diagonals.
      switch (pos) {
        case "n":
          s.top = "0";    s.left  = `${CORNER}px`; s.right  = `${CORNER}px`; s.height = `${EDGE}px`; break;
        case "s":
          s.bottom = "0"; s.left  = `${CORNER}px`; s.right  = `${CORNER}px`; s.height = `${EDGE}px`; break;
        case "e":
          s.right = "0";  s.top   = `${CORNER}px`; s.bottom = `${CORNER}px`; s.width  = `${EDGE}px`; break;
        case "w":
          s.left = "0";   s.top   = `${CORNER}px`; s.bottom = `${CORNER}px`; s.width  = `${EDGE}px`; break;
        case "ne":
          s.top = "0"; s.right = "0";    s.width = `${CORNER}px`; s.height = `${CORNER}px`; break;
        case "nw":
          s.top = "0"; s.left  = "0";    s.width = `${CORNER}px`; s.height = `${CORNER}px`; break;
        case "se":
          s.bottom = "0"; s.right = "0"; s.width = `${CORNER}px`; s.height = `${CORNER}px`; break;
        case "sw":
          s.bottom = "0"; s.left  = "0"; s.width = `${CORNER}px`; s.height = `${CORNER}px`; break;
      }
      this._panel.appendChild(handle);

      let resizing = false;
      let startX = 0, startY = 0;
      let startW = 0, startH = 0;
      let startL = 0, startT = 0;

      handle.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        const rect = this._panel.getBoundingClientRect();
        startX = ev.clientX; startY = ev.clientY;
        startW = rect.width; startH = rect.height;
        startL = rect.left;  startT = rect.top;
        // Pin to absolute pixels — same dance _bindChrome's drag-start
        // performs — so subsequent left / top / width / height writes
        // are not fought by CSS using right / bottom / transform.
        const ps = this._panel.style;
        ps.right     = "auto";
        ps.bottom    = "auto";
        ps.left      = startL + "px";
        ps.top       = startT + "px";
        ps.transform = "none";
        // Release CSS max-* clamps so user-set size is honoured.
        ps.maxWidth  = "none";
        ps.maxHeight = "none";
        resizing = true;
        handle.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        ev.stopPropagation();
      });

      handle.addEventListener("pointermove", (ev) => {
        if (!resizing) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let newW = startW, newH = startH, newL = startL, newT = startT;

        if (pos.includes("e")) {
          newW = clamp(startW + dx, this._minWidth,  window.innerWidth  - startL);
        }
        if (pos.includes("w")) {
          // Dragging the west edge moves left and changes width
          // by the opposite delta. Clamp left so width never
          // falls below minWidth.
          const maxL = startL + startW - this._minWidth;
          newL = clamp(startL + dx, 0, maxL);
          newW = startL + startW - newL;
        }
        if (pos.includes("s")) {
          newH = clamp(startH + dy, this._minHeight, window.innerHeight - startT);
        }
        if (pos.includes("n")) {
          const maxT = startT + startH - this._minHeight;
          newT = clamp(startT + dy, 0, maxT);
          newH = startT + startH - newT;
        }

        const ps = this._panel.style;
        ps.left   = newL + "px";
        ps.top    = newT + "px";
        ps.width  = newW + "px";
        ps.height = newH + "px";

        this.onLayoutChanged.dispatch(this, undefined);
      });

      const endResize = (ev: PointerEvent): void => {
        if (!resizing) return;
        resizing = false;
        try { handle.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
        this._saveLayout();
        this.onLayoutChanged.dispatch(this, undefined);
      };
      handle.addEventListener("pointerup",     endResize);
      handle.addEventListener("pointercancel", endResize);
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  /** `true` when the panel is mounted and visible (pill hidden). */
  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  /** Reveal the panel; hide the floating reopen pill. */
  show(): void {
    if (this._destroyed) return;
    const wasVisible = this.visible;
    this._panel.style.display = "flex";
    this._pill.hidden = true;
    if (this._modal) {
      this._centerPanel();
    } else {
      this._clampToViewport();
      this._saveLayout();
    }
    bringFloatingPanelToFront(this._panel, this._modal);
    if (this._modal) this._showBackdrop();
    if (!wasVisible) this.onVisibilityChanged.dispatch(this, true);
  }

  /** Hide the panel and surface the floating reopen pill. */
  hide(): void {
    if (this._destroyed) return;
    const wasVisible = this.visible;
    this._panel.style.display = "none";
    if (!this._modal) this._pill.hidden = false;
    this._saveLayout();
    if (this._modal) this._hideBackdrop();
    if (wasVisible) this.onVisibilityChanged.dispatch(this, false);
  }

  /** Toggle visibility. */
  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  /** Tear down DOM + global listeners. Idempotent. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    unregisterFloatingPanel(this._panel);
    unregisterPill(this._pill);
    window.removeEventListener("resize", this._onResize);
    this._hideBackdrop();
    this._panel.remove();
    this._pill.remove();
  }


  // ── Modal backdrop ────────────────────────────────────────────

  private _showBackdrop(): void {
    if (!this._modal) return;
    if (this._backdrop) {
      // Already up — just re-sync the z so a re-show after
      // another panel has been brought-to-front still stacks
      // correctly.
      syncBackdropZ(this._backdrop, this._panel);
      return;
    }
    this._backdrop = showBackdrop(this._container, this._panel, () => this.hide());
    document.addEventListener("keydown", this._onModalKeydown);
  }

  private _hideBackdrop(): void {
    hideBackdrop(this._backdrop);
    this._backdrop = null;
    document.removeEventListener("keydown", this._onModalKeydown);
  }

  /**
   * Pin the panel dead-centre on the viewport. Project convention
   * is that every modal dialog is centered, so the base owns this
   * rather than every subclass redefining the same CSS rule.
   * Inline styles override anything the subclass CSS sets.
   */
  private _centerPanel(): void {
    const s = this._panel.style;
    s.position  = "fixed";
    s.top       = "50%";
    s.left      = "50%";
    s.right     = "auto";
    s.bottom    = "auto";
    s.transform = "translate(-50%, -50%)";
  }


  // ── Layout persistence ────────────────────────────────────────

  protected _restoreLayout(): void {
    let saved: {top?: number; left?: number; width?: number; height?: number; hidden?: boolean} | null = null;
    try {
      const raw = window.localStorage.getItem(this._storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch { saved = null; }

    const hasSavedPosition = !!saved
      && Number.isFinite(saved.left) && Number.isFinite(saved.top);
    const hasSavedSize = !!saved
      && Number.isFinite(saved.width) && Number.isFinite(saved.height);

    if (hasSavedPosition) {
      this._panel.style.right     = "auto";
      this._panel.style.left      = saved!.left + "px";
      this._panel.style.top       = saved!.top  + "px";
      // Same reason `_bindChrome`'s drag-start clears this — saved
      // coordinates are absolute, so any centering translate from
      // the panel's CSS would push it off-screen on restore.
      this._panel.style.transform = "none";
    } else {
      // First time this panel opens for the user — start centred.
      // Drag persists a new position; subsequent opens restore it.
      this._centerPanel();
    }

    if (hasSavedSize) {
      this._panel.style.bottom    = "auto";
      this._panel.style.width     = saved!.width!  + "px";
      this._panel.style.height    = saved!.height! + "px";
      // CSS max-* bounds (e.g. `max-height: calc(100vh - 32px)`)
      // would otherwise clip a user-resized panel; release them
      // so persisted size is honoured.
      this._panel.style.maxWidth  = "none";
      this._panel.style.maxHeight = "none";
    }

    if (hasSavedPosition || hasSavedSize) this._clampToViewport();

    if (saved?.hidden) {
      this._panel.style.display = "none";
      this._pill.hidden = false;
    }
  }

  protected _saveLayout(): void {
    if (this._modal) return;
    const state: {top?: number; left?: number; width?: number; height?: number; hidden: boolean} = {
      hidden: this._panel.style.display === "none",
    };
    const l = parseFloat(this._panel.style.left);
    const t = parseFloat(this._panel.style.top);
    if (Number.isFinite(l)) state.left = l;
    if (Number.isFinite(t)) state.top  = t;
    // Only persist size if the user actually set it via the
    // resize handles (inline pixel value present). Panels at
    // their CSS-default size store no width / height and
    // therefore continue to track future stylesheet changes.
    if (isPixelLength(this._panel.style.width))  state.width  = parseFloat(this._panel.style.width);
    if (isPixelLength(this._panel.style.height)) state.height = parseFloat(this._panel.style.height);
    try { window.localStorage.setItem(this._storageKey, JSON.stringify(state)); }
    catch { /* quota / disabled — drop silently */ }
  }

  protected _clampToViewport(): void {
    // Shrink user-set pixel size to fit the current viewport
    // first, so the subsequent position clamp can use the new
    // (smaller) rect.
    if (isPixelLength(this._panel.style.width)) {
      const w = parseFloat(this._panel.style.width);
      const maxW = Math.max(this._minWidth, window.innerWidth);
      if (w > maxW) this._panel.style.width = maxW + "px";
    }
    if (isPixelLength(this._panel.style.height)) {
      const h = parseFloat(this._panel.style.height);
      const maxH = Math.max(this._minHeight, window.innerHeight);
      if (h > maxH) this._panel.style.height = maxH + "px";
    }

    // Only clamp pixel offsets. `parseFloat("50%")` returns 50,
    // which would otherwise get written back as `left: 50px;` and
    // — combined with a centering `translate(-50%, -50%)` —
    // throw a centered modal off the top-left of the viewport.
    if (!isPixelLength(this._panel.style.left)) return;
    if (!isPixelLength(this._panel.style.top))  return;
    const l = parseFloat(this._panel.style.left);
    const t = parseFloat(this._panel.style.top);
    const rect = this._panel.getBoundingClientRect();
    const maxL = Math.max(0, window.innerWidth  - rect.width);
    const maxT = Math.max(0, window.innerHeight - rect.height);
    this._panel.style.left = Math.max(0, Math.min(l, maxL)) + "px";
    this._panel.style.top  = Math.max(0, Math.min(t, maxT)) + "px";
  }
}


function isPixelLength(value: string): boolean {
  return /^-?\d+(\.\d+)?px$/.test(value);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
