import {Data, DataEvents, DataModel, type DataModelParams} from "../../data";
import {FloatingPanelFlowHost} from "./FloatingPanelFlowHost";
import {Scene, type SceneModelParams} from "../../scene";
import {XGFExporter} from "../../formats/xgf";
import {DotBIMExporter} from "../../formats/dotbim";
import {OBJExporter} from "../../formats/obj";
import {MTLExporter} from "../../formats/mtl";

function downloadIconDataUri(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <rect x="10" y="8" width="40" height="44" rx="8" fill="#fff" stroke="#888" stroke-width="2"/>
  <path d="M30 18v16" stroke="#4a90e2" stroke-width="3" stroke-linecap="round"/>
  <path d="M23 28l7 7 7-7" fill="none" stroke="#4a90e2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="19" y="39" width="22" height="4" rx="2" fill="#4a90e2"/>
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Floating, dependency-free HTML view that shows download actions
 * for the currently loaded model in several formats.
 *
 * Each button calls a stub method that returns dummy data.
 * Replace those methods with real serializers/exporters later.
 *
 * Usage:
 *   const panel = DownloadPanel.show(flowHost, data, { title: "Downloads" });
 *   // later:
 *   panel.destroy();
 */
export class DownloadPanel {
  static #HOST_ID = "__download_panel_host__";
  static #STYLE_ID = "__download_panel_style__";
  static #MASTER_STATE_KEY = "__download_panel_collapsed__";

  #scene: Scene;
  #data: Data;
  #events: DataEvents;
  #opts: any;
  #unsubs: Array<() => void> = [];

  #tileEl: HTMLElement | null = null;
  #countEl: HTMLElement | null = null;

  private constructor(flowHost: HTMLDivElement, scene: Scene, data: Data, opts: any = {}) {
    this.#scene = scene;
    this.#data = data;
    this.#events = data.events;
    this.#opts = opts;

    DownloadPanel.#ensureGlobalStyle();

    const root = this.render();
    const tile = FloatingPanelFlowHost.mountTile(root, {
      tileMinWidth: opts.tileMinWidth ?? opts.maxWidth ?? 360,
      tileMaxWidth: opts.tileMaxWidth ?? opts.maxWidth ?? 420,
    });

    flowHost.appendChild(tile);
    this.#tileEl = tile;

    this.#refreshModelCount();
  }

  static show(
    flowHost: HTMLDivElement,
    scene: Scene,
    data: Data,
    opts: {
      corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
      maxWidth?: number;
      zIndex?: number;
      startCollapsed?: boolean;
      title?: string;
      subtitle?: string;
      maxHeightVh?: number;
    } = {}
  ) {
    return new DownloadPanel(flowHost, scene, data, opts);
  }

  destroy() {
    for (const u of this.#unsubs) {
      try {
        u();
      } catch {
        // ignore
      }
    }
    this.#unsubs.length = 0;

    this.#tileEl?.remove();
    this.#tileEl = null;

    const host = document.getElementById(DownloadPanel.#HOST_ID);
    if (host) host.remove();
  }

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;

    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = DEFAULT_CSS;
    document.head.appendChild(s);
  }

  render() {
    const root = el("div", {className: "dlp-root"});

    const collapsed = readBool(
      DownloadPanel.#MASTER_STATE_KEY,
      !!this.#opts.startCollapsed
    );

    const header = this.renderHeader();
    const body = this.renderBody();

    root.appendChild(header);
    root.appendChild(body);

    this.#setMasterCollapsed(root, collapsed);

    header.addEventListener("click", () => {
      const nowCollapsed = !root.classList.contains("dlp-collapsed");
      this.#setMasterCollapsed(root, nowCollapsed);
      writeBool(DownloadPanel.#MASTER_STATE_KEY, nowCollapsed);
    });

    return root;
  }

  renderHeader() {
    const title = this.#opts.title ?? "Downloads";
    const subtitle =
      this.#opts.subtitle ?? "Export the currently loaded model in multiple formats";

    const header = el("div", {className: "dlp-header"});

    const icon = el("img", {
      className: "dlp-title-icon",
      width: 40,
      height: 40,
      alt: "Download",
      src: downloadIconDataUri(),
      draggable: false,
    });

    const textCol = el("div", {className: "dlp-title-col"}, [
      el("div", {className: "dlp-h1", textContent: title}),
      el("div", {className: "dlp-subtitle", textContent: subtitle}),
    ]);

    header.appendChild(icon);
    header.appendChild(textCol);

    return header;
  }

  renderBody() {
    const body = el("div", {className: "dlp-body"});

    body.appendChild(
      el("div", {className: "dlp-toolbar"}, [
        el("div", {className: "dlp-toolbar-left"}, [
          el("span", {className: "dlp-k", textContent: "DataModels:"}),
          el("span", {className: "dlp-v", textContent: "0"}),
        ]),
      ])
    );

    this.#countEl = body.querySelector<HTMLElement>(".dlp-v");

    const buttonGrid = el("div", {className: "dlp-grid"}, [
      this.#renderDownloadButton({
        label: "Download XGF",
        hint: ".xgf",
        onClick: () => this.#downloadXGF(),
      }),
      this.#renderDownloadButton({
        label: "Download DotBIM",
        hint: ".bim",
        onClick: () => this.#downloadDotBIM(),
      }),
      this.#renderDownloadButton({
        label: "Download OBJ + MTL",
        hint: ".obj + .mtl",
        onClick: () => this.#downloadOBJ(),
      }),
      this.#renderDownloadButton({
        label: "Download SceneModel JSON",
        hint: ".json",
        onClick: () => this.#downloadSceneModelJson(),
      }),
      this.#renderDownloadButton({
        label: "Download DataModel JSON",
        hint: ".json",
        onClick: () => this.#downloadDataModelJson(),
      }),
    ]);

    body.appendChild(buttonGrid);

    return body;
  }

  #renderDownloadButton(args: {
    label: string;
    hint: string;
    onClick: () => void;
  }) {
    const btn = el("button", {
      className: "dlp-download-btn",
      type: "button",
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        try {
          args.onClick();
        } catch (err) {
          console.error(err);
          alert("Download failed: " + ((err as any)?.message ?? String(err)));
        }
      },
    });

    btn.appendChild(el("div", {className: "dlp-download-btn-label", textContent: args.label}));
    btn.appendChild(el("div", {className: "dlp-download-btn-hint", textContent: args.hint}));

    return btn;
  }



  #refreshModelCount() {
    if (this.#countEl) {
      this.#countEl.textContent = String(Object.keys(this.#data.models ?? {}).length);
    }
  }

  #setMasterCollapsed(root: HTMLElement, collapsed: boolean) {
    root.classList.toggle("dlp-collapsed", collapsed);

    const body = root.querySelector<HTMLElement>(".dlp-body");
    if (body) body.style.display = collapsed ? "none" : "block";
  }

  #getPrimaryDataModel(): DataModel | null {
    const models = Object.values(this.#data.models ?? {});
    return (models[0] as DataModel | undefined) ?? null;
  }

  // ----------------------------------------------------------------------------
  // Download actions
  // ----------------------------------------------------------------------------

  #downloadXGF() {
    (new XGFExporter()).write({
      sceneModel: Object.values(this.#scene.models)[0],
      dataModel: Object.values(this.#data.models)[0]
    },{
      coordinateSystem: {
        basis: [
          1, 0, 0, // Right
          0, 0, 1, // Up
          0, 1, 0 // Forward
        ],
        origin: [0, 0, 0],
        units: "meters"
      }
    }).then(fileData => {
      downloadBlob(fileData, "model.xgf", "application/octet-stream");
    })
      .catch(e => {
        console.error(e);
      });
  }

  #downloadDotBIM() {
    (new DotBIMExporter()).write({
      sceneModel: Object.values(this.#scene.models)[0],
      dataModel: Object.values(this.#data.models)[0]
    }, {
      coordinateSystem: {
        basis: [
          1, 0, 0, // Right
          0, 0, 1, // Up
          0, 1, 0 // Forward
        ],
        origin: [0, 0, 0],
        units: "meters"
      }
    }).then(fileData => {
      downloadText(JSON.stringify(fileData, null, 2), "model.bim", "application/json");
    })
      .catch(e => {
        console.error(e);
      });
  }

  #downloadOBJ() {
    (new OBJExporter()).write({
      sceneModel: Object.values(this.#scene.models)[0]
    }, {
      coordinateSystem: {
        basis: [
          1, 0, 0, // Right
          0, 0, 1, // Up
          0, 1, 0 // Forward
        ],
        origin: [0, 0, 0],
        units: "meters"
      }
    }).then(fileData => {
      downloadText(fileData, "model.obj", "application/text");
    })
      .catch(e => {
        console.error(e);
      });

    (new MTLExporter()).write({
      sceneModel: Object.values(this.#scene.models)[0]
    }).then(fileData => {
      downloadText(fileData, "model.mtl", "application/text");
    })
      .catch(e => {
        console.error(e);
      });

  }

  #downloadSceneModelJson() {
    const json = this.#buildSceneModelJsonData();
    if (!json) {
      return;
    }

    downloadText(JSON.stringify(json, null, 2), "scene-model.json", "application/json");
  }

  #downloadDataModelJson() {
    const json = this.#buildDataModelJsonData();
    if (!json) {
      return;
    }
    downloadText(JSON.stringify(json, null, 2), "data-model.json", "application/json");
  }

  // ----------------------------------------------------------------------------
  // Stub serializers/exporters
  // Replace these with real implementations later.
  // ----------------------------------------------------------------------------

  #buildXKTData(): Uint8Array<any> {
    return new TextEncoder().encode("dummy xkt data");
  }

  #buildXGFData(): Uint8Array<any> {

    return new TextEncoder().encode("dummy xgf data");
  }

  #buildDotBIMData(): any {
    return {
      schema: "dotbim",
      version: "1.0.0-dummy",
      note: "Replace with real DotBIM export",
      meshes: [],
      elements: [],
    };
  }

  #buildSceneModelJsonData(): SceneModelParams | null {
    const model = Object.values(this.#scene.models)[0];
    if (!model) {
      return null;
    }
    const result = model.toParams();
    if (result.ok !== true) {
      console.error("Failed to serialize SceneModel: " + result.error);
      return null;
    } else {
      return result.value;
    }
  }

  #buildDataModelJsonData(): DataModelParams | null {
    const model = Object.values(this.#data.models)[0];
    if (!model) {
      return null;
    }
    const result = model.toParams();
    if (result.ok !== true) {
      console.error("Failed to serialize DataModel: " + result.error);
      return null;
    } else {
      return result.value;
    }
  }
}

// -----------------------------------------------------------------------------
// Small DOM utilities
// -----------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: any = {},
  children: Array<Node> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    (node as any)[key] = value;
  }
  for (const child of children) {
    node.appendChild(child);
  }
  return node;
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    sessionStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
}

function downloadBlob(data: BlobPart, fileName: string, mimeType: string) {
  const blob = new Blob([data], {type: mimeType});
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadText(text: string, fileName: string, mimeType = "text/plain;charset=utf-8") {
  downloadBlob(text, fileName, mimeType);
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// -----------------------------------------------------------------------------
// Default CSS
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.dlp-root {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #111;
  padding: 16px;
  background: rgba(255,255,255,0.96);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.14);
  backdrop-filter: blur(2px);
}

.dlp-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
}

.dlp-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}

.dlp-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}

.dlp-h1 {
  padding-top: 10px;
  font-size: 24px;
  color: #666666;
  font-weight: 650;
}

.dlp-subtitle {
  font-size: 12px;
  color: #444;
  line-height: 1.35;
}

.dlp-body {
  margin-top: 12px;
}

.dlp-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.dlp-toolbar-left {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.dlp-k {
  font-size: 12px;
  color: #666;
}

.dlp-v {
  font-size: 12px;
  font-weight: 650;
}

.dlp-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.dlp-download-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #e6e6e6;
  background: #fff;
  cursor: pointer;
  transition: background 0.13s, border-color 0.13s, transform 0.13s;
}

.dlp-download-btn:hover {
  background: #f7fafc;
  border-color: #b3c6e0;
}

.dlp-download-btn:active {
  transform: translateY(1px);
}

.dlp-download-btn-label {
  font-size: 13px;
  color: #2d5e8c;
  font-weight: 650;
}

.dlp-download-btn-hint {
  font-size: 11px;
  color: #666;
}
`;
