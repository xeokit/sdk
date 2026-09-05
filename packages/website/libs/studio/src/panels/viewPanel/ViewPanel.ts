import {FloatingPanelBase} from "../floatingPanelBase";
import {el} from "../../utils/el";
import {confirmDialog} from "../../dialogs/ConfirmDialog";


// "Dock window" glyph — a small panel docking into a larger
// frame. Matches the convention used by VS Code's "move into
// editor area" control and JetBrains' tool-window pin button.
// 12×12 viewBox; the host's `currentColor` paints both elements.
export const PIN_ICON_SVG =
  `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.2">
     <rect x="1" y="1" width="10" height="10" rx="1"/>
     <rect x="5" y="5" width="6" height="6" rx="0.5" fill="currentColor" stroke="none"/>
   </svg>`;

// "Undock" glyph — a small panel breaking out of a frame, with
// an arrow showing the lift direction. Used on the canvas-in-grid
// overlay to let the user pop a pinned View back into a floating
// panel.
export const UNPIN_ICON_SVG =
  `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.2">
     <path d="M2 7v3h7V5"/>
     <path d="M6 2h4v4"/>
     <path d="M10 2L5 7"/>
   </svg>`;

// "Minimize window" glyph — a single horizontal line near the
// bottom of the button, matching the Windows / GNOME / macOS
// minimize convention. The minimize button just hides the panel
// into the reopen pill; the genuinely destructive close lives on
// the {@link CLOSE_ICON_SVG} button next to it.
export const MINIMIZE_ICON_SVG =
  `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
     <line x1="2.5" y1="9" x2="9.5" y2="9"/>
   </svg>`;

// "Close window" glyph — the canonical ✕. Used on the View
// Panel's destroy button, which both tears the panel chrome down
// and destroys the underlying {@link viewing!viewer.View | View} —
// the action that warrants a confirm dialog.
export const CLOSE_ICON_SVG =
  `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
     <path d="M3 3l6 6"/>
     <path d="M9 3l-6 6"/>
   </svg>`;

const STYLE_TAG_ID = "xkt-vp-styles";
let _stylesInjected = false;

/**
 * Inject the shared ViewPanel stylesheet into `document.head` if
 * it isn't already there. Idempotent across calls and across
 * separate ViewPanel modules in different bundles (guarded by a
 * `<style id>` lookup as well as a module-local flag).
 *
 * Exported so callers that render `xkt-vp-panel` chrome **without**
 * constructing a `ViewPanel` instance (e.g. the pinned-cell
 * wrappers in `ViewManager`) can still pull the stylesheet in —
 * otherwise their buttons render unstyled because the constructor's
 * own `injectStylesOnce()` call never fires.
 */
export function ensureViewPanelStylesInjected(): void {
  injectStylesOnce();
}

function injectStylesOnce(): void {
  if (_stylesInjected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}

const PANEL_CSS = `
.xkt-vp-panel {
  position: fixed;
  top: 80px;
  left: 80px;
  display: flex;
  flex-direction: column;
  /* The panel itself is transparent — the body acts as a "hole"
     through which the renderer's shared WebGL canvas (which sits
     behind every floating panel at a lower z-index, see
     ViewManager._alignCanvasToView) is visible. The chrome the
     user perceives (header background, border, shadow,
     rounded corners) is supplied by the border / box-shadow
     here plus the header's own background. */
  background: transparent;
  /* pointer-events:none on the panel + auto on the header makes
     clicks in the body region fall through the panel and land on
     the shared WebGL canvas behind it. Without this the panel
     (z-index 100100000) intercepts every pointer event before it
     can reach the canvas (z-index 100000), and the hosted View's
     ModelNavigationController never sees camera-rotate / pan / zoom input —
     the panel appears frozen until window resize triggers a
     re-render via the global resize listener. */
  pointer-events: none;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #111;
  /* View-tier baseline. Sits above the shared WebGL canvas
     (z 100000) but below default-tier floating panels (200000000+).
     bringFloatingPanelToFront rewrites this inline on show /
     pointerdown using the view-tier counter (starts at 100100000). */
  z-index: 100100000;
  overflow: hidden;
  box-sizing: border-box;
  min-width: 240px;
  min-height: 180px;
}
.xkt-vp-panel *, .xkt-vp-panel *::before, .xkt-vp-panel *::after {
  box-sizing: border-box;
}
.xkt-vp-panel[hidden] { display: none; }

.xkt-vp-panel .xkt-vp-header {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 6px;
  border-bottom: 1px solid #ececec;
  flex: 0 0 auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  background: #fafafa;
  /* Re-enable pointer events for the chrome — the panel itself
     is transparent to pointer events so the body falls through
     to the WebGL canvas. The header (drag handle + close
     button) needs to intercept events to remain interactive. */
  pointer-events: auto;
}
.xkt-vp-panel .xkt-vp-header.xkt-vp-dragging { cursor: grabbing; }

.xkt-vp-panel .xkt-vp-title {
  /* Flex-grow so the title consumes leftover horizontal space and
     pushes the trailing button cluster to the right edge. min-width
     0 lets the ellipsis kick in inside a flex child. */
  flex: 1 1 auto;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  color: #2d5e8c;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xkt-vp-panel .xkt-vp-close,
.xkt-vp-panel .xkt-vp-pin,
.xkt-vp-panel .xkt-vp-undock,
.xkt-vp-panel .xkt-vp-destroy {
  width: 24px;
  height: 24px;
  padding: 0;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: #2d5e8c;
  background: #eef2f7;
  border: 1px solid #c8d4e2;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.xkt-vp-panel .xkt-vp-close:hover,
.xkt-vp-panel .xkt-vp-pin:hover,
.xkt-vp-panel .xkt-vp-undock:hover {
  background: #2d5e8c;
  color: white;
  border-color: #2d5e8c;
}
/* The destroy button is destructive, so its hover state reaches
   for the danger palette (matching the confirm dialog's danger
   variant) instead of the studio accent blue. */
.xkt-vp-panel .xkt-vp-destroy:hover {
  background: #b91c1c;
  color: white;
  border-color: #b91c1c;
}
.xkt-vp-panel .xkt-vp-pin svg,
.xkt-vp-panel .xkt-vp-close svg,
.xkt-vp-panel .xkt-vp-undock svg,
.xkt-vp-panel .xkt-vp-destroy svg {
  width: 15px;
  height: 15px;
  display: block;
  stroke-width: 1.6;
}

/* Pinned-cell variant. The cell wrapper reuses the floating
 * panel's header / button styles by carrying xkt-vp-panel as a
 * class; these overrides strip the floating-panel-only chrome
 * (fixed positioning, drop shadow, large z-index, etc.) so the
 * cell behaves like a regular grid child. */
.xkt-vp-panel.xkt-view-cell {
  position: relative;
  /* Base .xkt-vp-panel ships top:80px / left:80px so a freshly
     opened floating panel doesn't land flush against the
     viewport's top-left corner. In docked mode the cell sits
     inside a grid track and those offsets push the cell out of
     its slot — clear them. */
  top: auto;
  left: auto;
  right: auto;
  bottom: auto;
  background: black;
  border: 1px solid white;
  border-radius: 0;
  box-shadow: none;
  z-index: auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  color: white;
}
.xkt-vp-panel.xkt-view-cell .xkt-vp-header {
  cursor: default;
}

.xkt-vp-panel .xkt-vp-resize {
  /* Custom resize handle pinned to the panel's bottom-right
     corner. The CSS-native resize: both handle can't be used
     because the panel itself is pointer-events:none (to let
     clicks fall through to the WebGL canvas behind the body);
     this child element re-enables pointer events only in the
     resize corner so the canvas stays clickable everywhere else. */
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  pointer-events: auto;
  background:
    linear-gradient(
      135deg,
      transparent 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.25) 50%,
      rgba(0, 0, 0, 0.25) 60%,
      transparent 60%,
      transparent 70%,
      rgba(0, 0, 0, 0.25) 70%,
      rgba(0, 0, 0, 0.25) 80%,
      transparent 80%
    );
  border-bottom-right-radius: 12px;
  z-index: 1;
  touch-action: none;
}

.xkt-vp-panel .xkt-vp-body {
  flex: 1 1 auto;
  position: relative;
  overflow: hidden;
  /* The renderer's shared WebGL canvas sits at z-index 100000
     and is positioned over the body's bounding rect every frame
     (see ViewManager._alignCanvasToView). The panel itself is
     z-index 200000000, so anything we render on this body
     covers the canvas behind it. Keep the body transparent so
     the WebGL surface is visible; a solid background would
     occlude every painted frame and the View would look frozen
     until the renderer happened to nudge the canvas's CSS
     layout (e.g. on window resize). */
  background: transparent;
}
.xkt-vp-panel .xkt-vp-body > img,
.xkt-vp-panel .xkt-vp-body > canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
  margin: 0;
  padding: 0;
}

.xkt-vp-pill {
  position: fixed;
  bottom: 17px;
  right: 17px;
  /* Reopen pill for the view panel — same view-tier baseline as
     the panel itself, so it sits beneath default-tier panels. */
  z-index: 100100000;
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-vp-pill:hover { background: #1f4669; }
.xkt-vp-pill[hidden] { display: none; }
`;


/**
 * Parameters for {@link ViewPanel}.
 */
export interface ViewPanelParams {

  /** DOM container for the panel + pill. Defaults to `document.body`. */
  container?: HTMLElement;

  /** Text shown in the panel header and on the reopen pill. */
  title?: string;

  /**
   * `localStorage` key for the panel's drag-position + closed state.
   * Each ViewPanel needs a unique key so two panels don't share a slot.
   */
  storageKey?: string;

  /** Initial panel width in pixels (excluding chrome). Default `480`. */
  width?: number;

  /** Initial panel height in pixels (including chrome). Default `360`. */
  height?: number;

  /**
   * Initial panel left edge in CSS pixels from the viewport's
   * top-left. Default — leave the panel's stylesheet default
   * (`80px`). Supplying `x` (or `y`) makes the caller's value
   * **win over any persisted localStorage layout**, which gives
   * test/snapshot runs deterministic placement regardless of
   * a developer's prior drags.
   */
  x?: number;

  /**
   * Initial panel top edge in CSS pixels from the viewport's
   * top-left. Default — stylesheet default (`80px`). Same
   * "wins over localStorage" semantics as `x`.
   */
  y?: number;

  /**
   * Invoked when the panel's minimize button is clicked, *after* the
   * panel hides itself. The View is preserved and re-revealed when
   * the user clicks the side-rail pill — minimize is non-destructive.
   * For actual View teardown, use {@link onDestroy} instead.
   */
  onClose?: () => void;

  /**
   * Invoked when the panel's pin / dock button is clicked. The handler
   * is responsible for moving the hosted canvas into the flow layout
   * and tearing the panel down; see
   * {@link demo!studio.viewManager.ViewManager.pinView | ViewManager.pinView}.
   * The pin button is omitted when `onPin` is not supplied.
   */
  onPin?: () => void;

  /**
   * Invoked when the panel's destroy button (✕) is clicked and the
   * user confirms the modal dialog. The handler is responsible for
   * destroying the wrapped View; the panel itself is torn down
   * automatically via {@link FloatingPanelBase.destroy} just before
   * this hook fires. The destroy button is omitted when `onDestroy`
   * is not supplied.
   */
  onDestroy?: () => void;

  /**
   * When `true` (the default), clicking the destroy button opens a
   * modal confirm/cancel dialog and only tears the panel + View
   * down after the user confirms. Set to `false` to skip the
   * dialog — useful for tests and for callers that gate destruction
   * themselves.
   *
   * Programmatic `panel.destroy()` calls and the Escape-to-minimize
   * shortcut bypass the dialog — only the destroy-button click is
   * gated.
   */
  confirmOnDestroy?: boolean;
}


/**
 * A floating, draggable panel hosting a single {@link viewing!viewer.View | View}'s
 * canvas. Used by {@link demo!studio.viewManager.createView | studio.viewManager.createView}
 * when called with `floating: true`, so each new View opens in its own
 * panel with the same chrome (header / drag / close / reopen pill)
 * as the rest of the demo widgets.
 *
 * The View's canvas element is appended into {@link body} by the caller
 * after construction; the panel's CSS sizes the canvas to fill the body.
 */
export class ViewPanel extends FloatingPanelBase {

  private _body!: HTMLDivElement;
  private _titleEl!: HTMLSpanElement;
  private _resizeHandle!: HTMLDivElement;
  private _pinBtn?: HTMLButtonElement;
  private _destroyBtn?: HTMLButtonElement;
  private _onCloseCallback: (() => void) | undefined;
  private _onDestroyCallback: (() => void) | undefined;

  /** Per-drag resize state. */
  private _resizing = false;
  private _resizeStartX = 0;
  private _resizeStartY = 0;
  private _resizeStartW = 0;
  private _resizeStartH = 0;

  constructor(params: ViewPanelParams = {}) {
    super({
      container:   params.container,
      storageKey:  params.storageKey || `xkt-vp-${Math.random().toString(36).slice(2, 8)}`,
      classPrefix: "xkt-vp",
      tier:        "view",
    });

    this._onCloseCallback   = params.onClose;
    this._onDestroyCallback = params.onDestroy;

    injectStylesOnce();
    this._buildDom(params);
    this._bindChrome();

    // `_bindChrome` calls `_restoreLayout`, which overwrites the
    // inline left/top/width/height with whatever's in localStorage.
    // For caller-explicit values we want the OPPOSITE: the caller
    // asked for a specific placement (typically because they're
    // running a deterministic test that depends on the canvas
    // size), so re-apply after restore. Persisted user drags
    // continue to work normally for any field the caller didn't
    // pin.
    //
    // When `_restoreLayout` finds no saved position it calls
    // `_centerPanel()`, which sets `left: 50%; top: 50%;
    // transform: translate(-50%, -50%)` to centre the panel on
    // the viewport. We need to clear that transform when the
    // caller pinned a position, otherwise our `${x}px` / `${y}px`
    // pixel values are interpreted as the panel's *centre*, which
    // hangs half the panel off the top-left of the viewport.
    if (params.x !== undefined || params.y !== undefined) {
      this._panel.style.transform = "none";
      this._panel.style.right     = "auto";
      this._panel.style.bottom    = "auto";
    }
    if (params.x      !== undefined) this._panel.style.left   = `${params.x}px`;
    if (params.y      !== undefined) this._panel.style.top    = `${params.y}px`;
    if (params.width  !== undefined) this._panel.style.width  = `${params.width}px`;
    if (params.height !== undefined) this._panel.style.height = `${params.height}px`;

    // Gate destroy-button clicks behind a confirm dialog. Destroy
    // tears down the panel chrome AND the underlying View — far
    // more disruptive than minimize. On confirm we fire
    // `_onDestroyCallback` directly; the callback (wired by
    // ViewManager) routes through `destroyView`, which itself
    // calls `panel.destroy()` to tear the chrome down. We do
    // NOT override `panel.destroy()` here, because pin/unpin
    // and other internal cleanups also destroy the panel and
    // must NOT trigger View teardown — the destroy hook fires
    // only on the explicit user gesture.
    if (this._destroyBtn && params.confirmOnDestroy !== false) {
      const headerTitle = params.title || "View";
      this._destroyBtn.addEventListener("click", (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        confirmDialog({
          title:        "Close View?",
          message:      `Close "${headerTitle}"? This will destroy the View and discard its render state. This cannot be undone.`,
          confirmLabel: "Close",
          cancelLabel:  "Cancel",
          variant:      "danger",
          container:    this._container,
        }).then((ok) => {
          if (!ok) return;
          this._onDestroyCallback?.();
        });
      });
    } else if (this._destroyBtn) {
      // Destruction without confirm — same routing.
      this._destroyBtn.addEventListener("click", (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        this._onDestroyCallback?.();
      });
    }
  }

  /**
   * The body element where the View's canvas (typically the
   * `<img>` element auto-created by Studio) should be appended.
   */
  get body(): HTMLElement {
    return this._body;
  }

  /**
   * Header strip element. Exposed so ViewManager can attach
   * extra pointermove / pointerup listeners alongside the
   * FloatingPanelBase drag listeners — used to detect
   * drag-to-dock when the user drags a floating ViewPanel up to
   * the top of the page.
   */
  get headerElement(): HTMLElement {
    return this._header;
  }

  /**
   * Root panel element (the draggable, resizable container).
   * Exposed so ViewManager can read the panel's current
   * bounding rect during a header drag without reaching into
   * the protected base-class field.
   */
  get panelElement(): HTMLElement {
    return this._panel;
  }

  /**
   * Update the panel header + reopen-pill caption.
   */
  setTitle(title: string): void {
    this._titleEl.textContent = title;
    this._pill.textContent = title;
  }

  protected _buildDom(params: ViewPanelParams = {}): void {
    const width  = params.width  ?? 480;
    const height = params.height ?? 360;
    const title  = params.title  ?? "View";

    this._pill = el("button", "xkt-vp-pill", {
      type:        "button",
      title:       "Reopen the View",
      hidden:      true,
      textContent: title,
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-vp-panel");
    this._panel.style.width  = `${width}px`;
    this._panel.style.height = `${height}px`;
    if (params.x !== undefined) this._panel.style.left = `${params.x}px`;
    if (params.y !== undefined) this._panel.style.top  = `${params.y}px`;

    this._header = el("div", "xkt-vp-header");
    this._titleEl = el("span", "xkt-vp-title", {textContent: title});
    this._header.appendChild(this._titleEl);

    // Pin / dock button — only shown when the host passes an
    // `onPin` callback. The icon is a small panel docking into a
    // larger frame: standard "dock window" glyph from the
    // VS Code / IntelliJ window-controls family.
    if (params.onPin) {
      this._pinBtn = el("button", "xkt-vp-pin", {
        type:         "button",
        "aria-label": "Dock View into layout",
        title:        "Dock View",
        innerHTML:    PIN_ICON_SVG,
      }) as HTMLButtonElement;
      this._pinBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        params.onPin!();
      });
      this._header.appendChild(this._pinBtn);
    }

    // Functionally a minimize button: hides the panel and surfaces
    // the reopen pill so the user can bring it back. The class is
    // still `xkt-vp-close` for backwards-compat with the base
    // class's `_closeBtn` setup — only the user-facing labels
    // and glyph have moved to minimize-style.
    this._closeBtn = el("button", "xkt-vp-close", {
      type:         "button",
      "aria-label": "Minimize View",
      title:        "Minimize View",
      innerHTML:    MINIMIZE_ICON_SVG,
    }) as HTMLButtonElement;
    this._header.appendChild(this._closeBtn);

    // Destroy button — only shown when the host passes an
    // `onDestroy` callback. Destroying the panel tears down the
    // wrapped View as well (the host hook is responsible for
    // that). The confirm-dialog gate that used to live on the
    // close button has moved here in the constructor.
    if (params.onDestroy) {
      this._destroyBtn = el("button", "xkt-vp-destroy", {
        type:         "button",
        "aria-label": "Close View (destroy)",
        title:        "Close View",
        innerHTML:    CLOSE_ICON_SVG,
      }) as HTMLButtonElement;
      this._header.appendChild(this._destroyBtn);
    }

    this._panel.appendChild(this._header);

    this._body = el("div", "xkt-vp-body") as HTMLDivElement;
    this._panel.appendChild(this._body);

    // Custom bottom-right resize handle. CSS-native `resize: both`
    // doesn't fire because the panel itself is pointer-events:none
    // (so clicks fall through to the WebGL canvas behind the body);
    // this handle is the one pointer-events:auto exception in the
    // panel's box, restoring the corner drag-resize affordance.
    this._resizeHandle = el("div", "xkt-vp-resize", {
      "aria-label": "Resize View",
      title:        "Resize View",
    }) as HTMLDivElement;
    this._panel.appendChild(this._resizeHandle);
    this._wireResize();

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);

    if (this._onCloseCallback) {
      // FloatingPanelBase wires _closeBtn.click to hide(); we add a
      // second listener that fires the caller's hook afterwards.
      this._closeBtn.addEventListener("click", () => {
        this._onCloseCallback!();
      });
    }
  }

  /**
   * Drag-resize handler for the bottom-right corner. Tracks the
   * pointer through capture so movement outside the handle keeps
   * resizing — same pattern as the header's drag-move logic in
   * {@link FloatingPanelBase._bindChrome}.
   *
   * Each `pointermove` fires {@link FloatingPanelBase.onLayoutChanged}
   * so hosts that track the panel's viewport rect (the Studio
   * shared WebGL canvas re-aligns) update in lockstep with the
   * resize.
   */
  private _wireResize(): void {
    this._resizeHandle.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const rect = this._panel.getBoundingClientRect();
      this._resizing = true;
      this._resizeStartX = ev.clientX;
      this._resizeStartY = ev.clientY;
      this._resizeStartW = rect.width;
      this._resizeStartH = rect.height;
      this._resizeHandle.setPointerCapture(ev.pointerId);
    });

    this._resizeHandle.addEventListener("pointermove", (ev) => {
      if (!this._resizing) return;
      const dx = ev.clientX - this._resizeStartX;
      const dy = ev.clientY - this._resizeStartY;
      // CSS min-width / min-height clamp the lower bound; we let
      // the browser's own min-* enforcement kick in by writing the
      // raw target dimensions. No upper clamp — drag past the
      // viewport edge and the panel grows; FloatingPanelBase's
      // `_clampToViewport` will tug it back inside on the next
      // viewport resize.
      const newW = Math.max(0, this._resizeStartW + dx);
      const newH = Math.max(0, this._resizeStartH + dy);
      this._panel.style.width  = `${newW}px`;
      this._panel.style.height = `${newH}px`;
      this.onLayoutChanged.dispatch(this, undefined);
    });

    const endResize = (ev: PointerEvent): void => {
      if (!this._resizing) return;
      this._resizing = false;
      try { this._resizeHandle.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      this.onLayoutChanged.dispatch(this, undefined);
    };
    this._resizeHandle.addEventListener("pointerup",     endResize);
    this._resizeHandle.addEventListener("pointercancel", endResize);
  }
}
