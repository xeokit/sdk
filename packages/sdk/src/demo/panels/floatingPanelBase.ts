/**
 * Base class for the floating demo panels (`SceneHealthPanel`,
 * `DataHealthPanel`, `SceneStatsPanel`, `DataStatsPanel`,
 * `BoundariesPanel`, `TilesPanel`, `EventsPanel`,
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
import {EventEmitter} from "../../core";
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

  protected readonly _container: HTMLElement;
  protected readonly _storageKey: string;
  protected readonly _classPrefix: string;
  protected readonly _modal: boolean;
  protected _destroyed = false;

  private _dragging = false;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;
  private _chromeBound = false;
  private _backdrop: HTMLElement | null = null;

  private readonly _onResize = (): void => {
    this._clampToViewport();
    this._saveLayout();
  };

  private readonly _onModalKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape" && this.visible) this.hide();
  };

  protected constructor(params: FloatingPanelBaseParams) {
    this._container = params.container || document.body;
    this._storageKey = params.storageKey;
    this._classPrefix = params.classPrefix;
    this._modal = params.modal === true;
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
    });
    const endDrag = (ev: PointerEvent): void => {
      if (!this._dragging) return;
      this._dragging = false;
      this._header.classList.remove(draggingClass);
      try { this._header.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      this._saveLayout();
    };
    this._header.addEventListener("pointerup",     endDrag);
    this._header.addEventListener("pointercancel", endDrag);

    window.addEventListener("resize", this._onResize);
    // Modals always centre themselves on show; persisting a
    // dragged position would fight that on the next open.
    if (!this._modal) this._restoreLayout();
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
    let saved: {top?: number; left?: number; hidden?: boolean} | null = null;
    try {
      const raw = window.localStorage.getItem(this._storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch { saved = null; }

    const hasSavedPosition = !!saved
      && Number.isFinite(saved.left) && Number.isFinite(saved.top);

    if (hasSavedPosition) {
      this._panel.style.right     = "auto";
      this._panel.style.left      = saved!.left + "px";
      this._panel.style.top       = saved!.top  + "px";
      // Same reason `_bindChrome`'s drag-start clears this — saved
      // coordinates are absolute, so any centering translate from
      // the panel's CSS would push it off-screen on restore.
      this._panel.style.transform = "none";
      this._clampToViewport();
    } else {
      // First time this panel opens for the user — start centred.
      // Drag persists a new position; subsequent opens restore it.
      this._centerPanel();
    }

    if (saved?.hidden) {
      this._panel.style.display = "none";
      this._pill.hidden = false;
    }
  }

  protected _saveLayout(): void {
    if (this._modal) return;
    const state: {top?: number; left?: number; hidden: boolean} = {
      hidden: this._panel.style.display === "none",
    };
    const l = parseFloat(this._panel.style.left);
    const t = parseFloat(this._panel.style.top);
    if (Number.isFinite(l)) state.left = l;
    if (Number.isFinite(t)) state.top  = t;
    try { window.localStorage.setItem(this._storageKey, JSON.stringify(state)); }
    catch { /* quota / disabled — drop silently */ }
  }

  protected _clampToViewport(): void {
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
