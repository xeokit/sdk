import {FloatingPanelBase} from "../floatingPanelBase";
import {el} from "../../utils/el";


const STYLE_TAG_ID = "xkt-vp-styles";
let _stylesInjected = false;

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
     (z-index 200000000) intercepts every pointer event before it
     can reach the canvas (z-index 100000), and the hosted View's
     ViewController never sees camera-rotate / pan / zoom input —
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
  z-index: 200000000;
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
  justify-content: space-between;
  align-items: center;
  height: 22px;
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
  font-size: 11px;
  font-weight: 600;
  color: #2d5e8c;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xkt-vp-panel .xkt-vp-close {
  width: 18px;
  height: 18px;
  padding: 0;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-vp-panel .xkt-vp-close:hover {
  background: #ececec;
  color: #222;
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
  z-index: 200000000;
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
   * Invoked when the panel's close button is clicked, *after* the panel
   * hides itself. Use this hook to also destroy the wrapped View — by
   * default the View is preserved and re-revealed when the pill is
   * clicked.
   */
  onClose?: () => void;
}


/**
 * A floating, draggable panel hosting a single {@link viewing!viewer.View | View}'s
 * canvas. Used by {@link demo!DemoHelper.createView | DemoHelper.createView}
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
  private _onCloseCallback: (() => void) | undefined;

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
    });

    this._onCloseCallback = params.onClose;

    injectStylesOnce();
    this._buildDom(params);
    this._bindChrome();
  }

  /**
   * The body element where the View's canvas (typically the
   * `<img>` element auto-created by DemoHelper) should be appended.
   */
  get body(): HTMLElement {
    return this._body;
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

    this._header = el("div", "xkt-vp-header");
    this._titleEl = el("span", "xkt-vp-title", {textContent: title});
    this._header.appendChild(this._titleEl);

    this._closeBtn = el("button", "xkt-vp-close", {
      type:         "button",
      "aria-label": "Close View",
      title:        "Close View",
      innerHTML:    "×",
    }) as HTMLButtonElement;
    this._header.appendChild(this._closeBtn);
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
   * so hosts that track the panel's viewport rect (the DemoHelper
   * forwards this to the hosted View's `needsRender()` so the
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
