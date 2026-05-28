/**
 * Floating, draggable panel for importing PDF drawings via
 * drag-and-drop or a native file picker. Constructs a {@link PDFLoader}
 * internally and loads each dropped file into a fresh
 * {@link SceneModel}, then auto-frames the camera on the result — so
 * any PDF (vector + fills + text or scanned raster) is one drop away
 * from being on screen.
 *
 * pdf.js itself is fetched by PDFLoader on first use (CDN-by-default,
 * overridable via {@link PDFLoadOptions.pdfjsEsmUrl} for self-hosting
 * or pre-init injection); the panel takes no adapter parameter.
 *
 * Same chrome / lifecycle as the other floating panels (drag header,
 * close + pill, layout persistence, per-Studio WeakMap registry,
 * idempotent `getFor` / `openFor`).
 *
 */

import {PDFLoader} from "../../../formats/pdf/PDFLoader";

import type {Studio} from "../../Studio";
import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";


// ─────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-pdfimp-styles";
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
.xkt-pdfimp-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 380px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
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
}
.xkt-pdfimp-panel *, .xkt-pdfimp-panel *::before, .xkt-pdfimp-panel *::after { box-sizing: border-box; }
.xkt-pdfimp-panel[hidden] { display: none; }

.xkt-pdfimp-panel .xkt-pdfimp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 12px 16px;
  border-bottom: 1px solid #ececec;
  flex: 0 0 auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.xkt-pdfimp-panel .xkt-pdfimp-header.xkt-pdfimp-dragging { cursor: grabbing; }
.xkt-pdfimp-panel .xkt-pdfimp-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-pdfimp-panel .xkt-pdfimp-title-icon {
  width: 22px; height: 22px; color: #2d5e8c;
  display: inline-flex; align-items: center; justify-content: center;
}
.xkt-pdfimp-panel .xkt-pdfimp-title-icon svg { width: 100%; height: 100%; }
.xkt-pdfimp-panel .xkt-pdfimp-close {
  flex-shrink: 0; width: 26px; height: 26px; padding: 0;
  font: inherit; font-size: 18px; line-height: 1; color: #777;
  background: transparent; border: 1px solid transparent;
  border-radius: 6px; cursor: pointer;
}
.xkt-pdfimp-panel .xkt-pdfimp-close:hover { background: #ececec; color: #222; }

.xkt-pdfimp-panel .xkt-pdfimp-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.xkt-pdfimp-panel .xkt-pdfimp-drop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 12px;
  border: 2px dashed #c5d3e0;
  border-radius: 10px;
  background: #fbfdff;
  color: #3a566f;
  text-align: center;
  cursor: pointer;
  transition: border-color 100ms ease-out, background 100ms ease-out;
}
.xkt-pdfimp-panel .xkt-pdfimp-drop:hover {
  border-color: #2d5e8c;
  background: #f4f9ff;
}
.xkt-pdfimp-panel .xkt-pdfimp-drop.xkt-pdfimp-dragover {
  border-color: #2d5e8c;
  background: #e9f1fa;
  border-style: solid;
}
.xkt-pdfimp-panel .xkt-pdfimp-drop-headline {
  font-weight: 650;
  color: #2d5e8c;
  font-size: 13px;
}
.xkt-pdfimp-panel .xkt-pdfimp-drop-sub {
  font-size: 11px;
  color: #6a8294;
}
.xkt-pdfimp-panel .xkt-pdfimp-pick-btn {
  margin-top: 4px;
  padding: 6px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-pdfimp-panel .xkt-pdfimp-pick-btn:hover { background: #1f4669; }
.xkt-pdfimp-panel .xkt-pdfimp-status {
  font-size: 11px;
  color: #555;
  min-height: 1.4em;
  font-variant-numeric: tabular-nums;
}
.xkt-pdfimp-panel .xkt-pdfimp-status.xkt-pdfimp-status-error { color: #b73d3d; }
.xkt-pdfimp-panel .xkt-pdfimp-status.xkt-pdfimp-status-ok    { color: #2c7e4f; }

.xkt-pdfimp-pill {
  position: fixed;
  bottom: 17px;
  right: 500px;
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
.xkt-pdfimp-pill:hover { background: #1f4669; }
.xkt-pdfimp-pill[hidden] { display: none; }
`;


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface PdfImportPanelParams {
  /** Studio whose scene + viewManager the panel drives. */
  studio: Studio;
  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;
  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class PdfImportPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<Studio, PdfImportPanel>();

  /** Title-bar icon — sheet of paper with a down-arrow into a tray. */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="5" y="3" width="11" height="14" rx="1.4" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M 13 3 L 13 7 L 17 7" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" ` +
            `stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M 12 20 L 12 13 M 9 17 L 12 20 L 15 17" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8" ` +
            `stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  }

  static getFor(studio: Studio): PdfImportPanel | undefined {
    const inst = PdfImportPanel._instances.get(studio);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: PdfImportPanelParams): PdfImportPanel {
    let inst = PdfImportPanel._instances.get(params.studio);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new PdfImportPanel(params);
    return inst;
  }


  readonly studio: Studio;
  private readonly _loader: PDFLoader;

  private _dropZone!: HTMLElement;
  private _fileInput!: HTMLInputElement;
  private _statusEl!: HTMLElement;

  constructor(params: PdfImportPanelParams) {
    if (!params || !params.studio) {
      throw new Error("PdfImportPanel: studio is required");
    }
    super({
      container:   params.container,
      storageKey:  "xkt-pdfimp-panel",
      classPrefix: "xkt-pdfimp",
    });
    this.studio = params.studio;
    // PDFLoader fetches pdf.js itself (CDN by default; override
    // via PDFLoadOptions if the host needs self-hosting or a
    // pre-initialised pdf.js instance).
    this._loader = new PDFLoader();

    const prior = PdfImportPanel._instances.get(this.studio);
    if (prior && !prior._destroyed) prior.destroy();
    PdfImportPanel._instances.set(this.studio, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireFileEvents();

    if (params.visible === false) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy(): void {
    if (this._destroyed) return;
    if (PdfImportPanel._instances.get(this.studio) === this) {
      PdfImportPanel._instances.delete(this.studio);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-pdfimp-pill", {
      type: "button",
      title: "Reopen PDF Import",
      hidden: true,
      textContent: "Import PDF",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-pdfimp-panel");

    // Header.
    this._header = el("div", "xkt-pdfimp-header");
    const title = el("h2", "xkt-pdfimp-title");
    title.innerHTML =
      `<span class="xkt-pdfimp-title-icon">${PdfImportPanel.iconSvg()}</span>` +
      `<span>Import PDF Drawing</span>`;

    this._closeBtn = el("button", "xkt-pdfimp-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body — drop zone + status line.
    const body = el("div", "xkt-pdfimp-body");

    this._dropZone = el("div", "xkt-pdfimp-drop");
    this._dropZone.innerHTML =
      `<div class="xkt-pdfimp-drop-headline">Drop a PDF here</div>` +
      `<div class="xkt-pdfimp-drop-sub">or</div>`;

    const pickBtn = el("button", "xkt-pdfimp-pick-btn", {
      type: "button",
      textContent: "Choose file…",
    }) as HTMLButtonElement;
    this._dropZone.appendChild(pickBtn);

    this._fileInput = el("input", "", {
      type: "file",
      accept: "application/pdf,.pdf",
      hidden: true,
    }) as HTMLInputElement;
    this._dropZone.appendChild(this._fileInput);

    body.appendChild(this._dropZone);

    this._statusEl = el("div", "xkt-pdfimp-status", {
      textContent: "Ready — drop or pick a PDF.",
    });
    body.appendChild(this._statusEl);

    this._panel.appendChild(body);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);

    // Internal handle for the click + file picker wired in _wireFileEvents.
    (this._dropZone as any)._pickBtn = pickBtn;
  }

  private _wireFileEvents(): void {
    const dz = this._dropZone;
    const pickBtn = (dz as any)._pickBtn as HTMLButtonElement;

    // Click anywhere in the drop zone (including the button) opens
    // the picker. Stop event propagation on the button so the wider
    // drop zone listener doesn't double-trigger.
    pickBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._fileInput.click();
    });
    dz.addEventListener("click", () => this._fileInput.click());

    this._fileInput.addEventListener("change", () => {
      const file = this._fileInput.files?.[0];
      if (file) void this._loadFile(file);
      // Clear so picking the same file twice in a row still triggers.
      this._fileInput.value = "";
    });

    // Drag + drop. preventDefault on dragover is required to make
    // the element a drop target; only then does the `drop` event fire.
    dz.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.classList.add("xkt-pdfimp-dragover");
    });
    dz.addEventListener("dragleave", () => {
      dz.classList.remove("xkt-pdfimp-dragover");
    });
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("xkt-pdfimp-dragover");
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
        this._setStatus(`Not a PDF: ${file.name}`, "error");
        return;
      }
      void this._loadFile(file);
    });
  }


  // ── Load orchestration ────────────────────────────────────────

  private async _loadFile(file: File): Promise<void> {
    this._setStatus(`Loading ${file.name}…`);

    // ModelId derived from filename for stability across reloads,
    // suffixed with a timestamp so re-dropping the same file twice
    // doesn't collide with an existing model.
    const baseId = file.name.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const modelId = `${baseId || "pdf"}-${Date.now().toString(36)}`;

    try {
      const fileData = await file.arrayBuffer();

      const sceneModelRes = this.studio.scene.createModel({id: modelId});
      if (sceneModelRes.ok === false) {
        this._setStatus(`Error: ${sceneModelRes.error}`, "error");
        return;
      }
      const sceneModel = sceneModelRes.value;

      const result = await this._loader.load({fileData, sceneModel}, {});

      if (result.ok === false) {
        sceneModel.destroy();
        this._setStatus(`Error: ${result.error}`, "error");
        return;
      }

      // Frame the camera on the new content.
      const view = this.studio.viewer?.viewList?.[0];
      if (view) {
        const aabb = this.studio.picking.collisionIndex.getSceneAABB();
        if (aabb) {
          try { this.studio.viewManager.fitToAabb(view, aabb); }
          catch { /* unfit-able sceneModels (no positions) — skip */ }
        }
      }

      // Aggregate per-page stats for the success line.
      const pages = result.value.pages;
      const totals = pages.reduce(
        (acc, p) => ({
          segs: acc.segs + (p.segmentCount  ?? 0),
          tris: acc.tris + (p.triangleCount ?? 0),
          imgs: acc.imgs + (p.imageCount    ?? 0),
          txt:  acc.txt  + (p.textCount     ?? 0),
        }),
        {segs: 0, tris: 0, imgs: 0, txt: 0},
      );
      this._setStatus(
        `Loaded ${file.name} — ${pages.length} page${pages.length === 1 ? "" : "s"}: ` +
        `${totals.segs} segments, ${totals.tris} fills, ${totals.imgs} images, ${totals.txt} labels`,
        "ok",
      );
    } catch (err: any) {
      this._setStatus(`Error: ${err?.message ?? String(err)}`, "error");
    }
  }

  private _setStatus(text: string, kind: "ok" | "error" | "info" = "info"): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = text;
    this._statusEl.classList.remove("xkt-pdfimp-status-ok", "xkt-pdfimp-status-error");
    if (kind === "ok")    this._statusEl.classList.add("xkt-pdfimp-status-ok");
    if (kind === "error") this._statusEl.classList.add("xkt-pdfimp-status-error");
  }
}
