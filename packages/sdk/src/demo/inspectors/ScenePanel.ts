
import {Scene, SceneEvents, SceneModel, type SceneModelStats} from "../../scene";
import {FloatingPanelFlowHost} from "./FloatingPanelFlowHost";

function fileIconSvg() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "smsm-fileicon");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `
    <rect x="3" y="2" width="10" height="12" rx="2" fill="#f7fafc" stroke="#b3c6e0" stroke-width="1.2"/>
    <rect x="5" y="5" width="6" height="1.2" rx="0.6" fill="#b3c6e0"/>
    <rect x="5" y="8" width="6" height="1.2" rx="0.6" fill="#b3c6e0"/>
    <rect x="5" y="11" width="4" height="1.2" rx="0.6" fill="#b3c6e0"/>
  `;
  return svg;
}


/**
 * Floating, dependency-free HTML view that shows a list of SceneModelStats panels,
 * one per SceneModel, and keeps them in sync with SceneEvents.
 *
 * - Immediately populates itself from existing Scene#models on show().
 * - Creates/destroys per-model panels when SceneModels are created/destroyed.
 * - Collapsible master panel + each model row collapsible.
 * - Absolutely-positioned floating host (like your other views).
 *
 * Usage:
 *   const view = SceneModelStats.show(scene, scene.events, { corner: "top-right" });
 *   // later:
 *   view.destroy();
 */
export class ScenePanel {
  static #HOST_ID = "__sms_multi_floating_host__";
  static #STYLE_ID = "__sms_multi_style__";
  static #MASTER_STATE_KEY = "__sms_multi_collapsed__";

  #scene: Scene;
  #events: SceneEvents;
  #opts: any;

  // modelId -> DOM + collapsed state
  #modelPanels = new Map<string, { root: HTMLElement; body: HTMLElement; collapsed: boolean }>();

  // unsubscribe fns for events
  #unsubs: Array<() => void> = [];

  #listEl: HTMLElement | null = null;
  #countEl: HTMLElement | null = null;
  #tileEl: HTMLElement | null = null;


  private constructor(flowHost: HTMLDivElement, scene: Scene,  opts: any = {}) {
    this.#scene = scene;
    this.#events = scene.events;
    this.#opts = opts;

    ScenePanel.#ensureGlobalStyle();

    const root = this.render();
    const tile = FloatingPanelFlowHost.mountTile(root, {
      tileMinWidth: opts.tileMinWidth ?? opts.maxWidth ?? 420,
      tileMaxWidth: opts.tileMaxWidth ?? opts.maxWidth ?? 440,
    });

    flowHost.appendChild(tile);
    this.#tileEl = tile;


    // Populate immediately from existing Scene#models
    this.#populateFromSceneModels();

    // Then listen for create/destroy going forward
    this.#wireEvents();
  }

  /**
   * Attaches to a Scene + SceneEvents and shows the floating panel.
   * Stats are read from SceneModel#stats.
   */
  static show(
    flowHost: HTMLDivElement,
    scene: Scene,
    opts: {
      corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
      maxWidth?: number;
      zIndex?: number;
      startCollapsed?: boolean;
      startModelsCollapsed?: boolean;
      title?: string;
      subtitle?: string;
      maxHeightVh?: number; // default 90
    } = {}
  ) {
    return new ScenePanel(flowHost, scene, opts);
  }

  /**
   * Removes UI and unsubscribes from SceneEvents.
   */
  destroy() {
    for (const u of this.#unsubs) {
      try {
        u();
      } catch {
        // ignore
      }
    }
    this.#unsubs.length = 0;
    this.#modelPanels.clear();

    const host = document.getElementById(ScenePanel.#HOST_ID);
    if (host) host.remove();
  }

  // ---------------------------------------------------------------------------
  // Initial population
  // ---------------------------------------------------------------------------

  #populateFromSceneModels() {
    const models = Object.values(this.#scene.models);
    for (const m of models) this.#addModel(m);
  }


  // ---------------------------------------------------------------------------
  // Host + global style management (singleton host)
  // ---------------------------------------------------------------------------

  static #getOrCreateHost(opts: any) {
    const {
      corner = "top-right",
      maxWidth = 540,
      zIndex = 2147483647,
      maxHeightVh = 90,
    } = opts;

    let host = document.getElementById(this.#HOST_ID) as HTMLDivElement | null;
    if (!host) {
      host = document.createElement("div");
      host.id = this.#HOST_ID;

      host.style.position = "absolute";
      host.style.maxHeight = `${maxHeightVh}vh`;
      host.style.overflow = "auto";
      host.style.background = "rgba(255,255,255,0.96)";
      host.style.border = "1px solid #e6e6e6";
      host.style.borderRadius = "12px";
      host.style.boxShadow = "0 6px 24px rgba(0,0,0,0.14)";
      host.style.backdropFilter = "blur(2px)";
      host.style.padding = "0";
      host.style.display = "block";
      host.style.zIndex = String(zIndex);
      host.style.pointerEvents = "auto";

      document.body.appendChild(host);
    }

    host.style.width = `min(${maxWidth}px, calc(100vw - 24px))`;

    host.style.top = "";
    host.style.right = "";
    host.style.bottom = "";
    host.style.left = "";

    switch (corner) {
      case "top-left":
        host.style.top = "12px";
        host.style.left = "12px";
        break;
      case "bottom-right":
        host.style.bottom = "12px";
        host.style.right = "12px";
        break;
      case "bottom-left":
        host.style.bottom = "12px";
        host.style.left = "12px";
        break;
      case "top-right":
      default:
        host.style.top = "12px";
        host.style.right = "12px";
        break;
    }

    return host;
  }

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;

    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = DEFAULT_CSS;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  render() {
    const root = el("div", { className: "smsm-root" });

    const collapsed = readBool(
      ScenePanel.#MASTER_STATE_KEY,
      !!this.#opts.startCollapsed
    );

    const header = this.renderHeader({ collapsed });
    const body = this.renderBody();

    root.appendChild(header);
    root.appendChild(body);

    this.#setMasterCollapsed(root, collapsed);

    const toggleBtn = header.querySelector<HTMLButtonElement>("[data-smsm-toggle]");
    toggleBtn?.addEventListener("click", () => {
      const nowCollapsed = !root.classList.contains("smsm-collapsed");
      this.#setMasterCollapsed(root, nowCollapsed);
      writeBool(ScenePanel.#MASTER_STATE_KEY, nowCollapsed);
    });

    return root;
  }

  renderHeader({ collapsed }: { collapsed: boolean }) {
    const title = this.#opts.title ?? "Scene";
    const subtitle = this.#opts.subtitle ?? "Scene graph statistics";

    const header = el("div", { className: "smsm-header" });

    // Icon
    const icon = el("img", {
      className: "smsm-title-icon",
      width: 40,
      height: 40,
      alt: "Scene models",
      src: sceneGraphIconDataUri(),
      draggable: false,
    });

    // Title and subtitle stacked vertically, left-justified
    const textCol = el("div", { className: "smsm-title-col" }, [
      el("div", { className: "smsm-h1", textContent: title }),
      el("div", { className: "smsm-subtitle", textContent: subtitle }),
    ]);

    // Flex row: icon | textCol
    header.appendChild(icon);
    header.appendChild(textCol);

    return header;
  }

  renderBody() {
    const body = el("div", { className: "smsm-body" });

    // --- CoordinateSystem panel ---
    const cs = this.#scene.coordinateSystem;
    if (cs) {
      body.appendChild(renderCoordSysPanel(cs, { collapsed: true, title: "Coordinate System", jsonTitle: "CoordinateSystem JSON" }));
    }

    // --- SceneModels stats ---
    body.appendChild(
      el("div", { className: "smsm-toolbar" }, [
        el("div", { className: "smsm-toolbar-left" }, [
          el("span", { className: "smsm-k", textContent: "SceneModels:" }),
          el("span", {
            className: "smsm-v",
            textContent: String(this.#modelPanels.size),
          }),
        ]),
      ])
    );

    // Cache count element (first .smsm-v inside this body)
    this.#countEl = body.querySelector<HTMLElement>(".smsm-v");

    // Create + cache list element
    const list = el("div", { className: "smsm-list" });
    body.appendChild(list);
    this.#listEl = list;

    return body;
  }


  refreshAll() {
    const models = Object.values(this.#scene.models);
    for (const m of models) this.#refreshModel(m);
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------

  #wireEvents() {
    // @ts-ignore
    const sub = <A, B>(emitter: any, handler: (a: A, b: B) => void): (() => void) => {
      if (emitter?.subscribe) {
        const token = emitter.subscribe(handler);
        if (typeof token === "function") return token;
        if (token?.unsubscribe) return () => token.unsubscribe();
        if (token?.dispose) return () => token.dispose();
      }
      if (emitter?.on) {
        emitter.on(handler);
        return () => emitter.off?.(handler);
      }
      if (emitter?.addListener) {
        emitter.addListener(handler);
        return () => emitter.removeListener?.(handler);
      }
      emitter?.add?.(handler);
      return () => emitter?.remove?.(handler);
    };

    this.#unsubs.push(
      sub<Scene, SceneModel>(this.#events.onSceneModelCreated, (_scene, model) => {
        this.#addModel(model);
      })
    );

    this.#unsubs.push(
      sub<Scene, SceneModel>(this.#events.onSceneModelDestroyed, (_scene, model) => {
        this.#removeModel(model);
      })
    );

    this.#unsubs.push(
      sub<Scene, Scene>(this.#events.onSceneDestroyed, () => {
        this.destroy();
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Model panel management
  // ---------------------------------------------------------------------------

  // In #addModel, always start collapsed:
  #addModel(model: SceneModel) {
    const id = this.#getModelId(model);
    if (this.#modelPanels.has(id)) return;

    const list = this.#listEl;
    if (!list) return;

    // Always start collapsed
    const startCollapsed = true;

    const panel = this.#renderModelPanel(model, startCollapsed);
    list.appendChild(panel.root);

    this.#modelPanels.set(id, panel);
    this.#updateModelCount();
  }


  #removeModel(model: SceneModel) {
    const id = this.#getModelId(model);
    const panel = this.#modelPanels.get(id);
    if (!panel) return;

    panel.root.remove();
    this.#modelPanels.delete(id);
    this.#updateModelCount();
  }

  #refreshModel(model: SceneModel) {
    const id = this.#getModelId(model);
    const panel = this.#modelPanels.get(id);
    if (!panel) return;

    const stats = (model as any)?.stats as SceneModelStats | null | undefined;
    const newBody = this.#renderStatsBody(stats);

    panel.body.replaceChildren(...Array.from(newBody.childNodes));
  }

  #renderModelPanel(model: SceneModel, startCollapsed: boolean) {
    const root = el("div", { className: "smsm-model" });

    const header = el("div", { className: "smsm-model-head" });
    const title = el("div", { className: "smsm-model-title" });

    const caret = el("span", {
      className: "smsm-model-caret",
      textContent: startCollapsed ? "▸" : "▾",
      ["data-smsm-model-caret" as any]: "",
    });

    const name = el("span", {
      className: "smsm-model-name",
      textContent: this.#getModelLabel(model),
      title: "SceneModel",
    });

    title.appendChild(caret);
    title.appendChild(name);

    header.appendChild(title);

    const viewJsonBtn = el("button", {
      className: "scenepanel-viewjson-btn",
      type: "button",
      textContent: "JSON",
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        const result = model.toParams();
        if (result && result.ok !== false) {
          openJsonInNewTab(result.value, "SceneModel JSON");
        }
      }
    });

    header.appendChild(viewJsonBtn);


    const body = el("div", { className: "smsm-model-body" });

    const cs = model.coordinateSystem;
    if (cs) {
      body.appendChild(renderCoordSysPanel(cs, { collapsed: true, title: "Coordinate System", jsonTitle: "SceneModel CoordinateSystem JSON" }));
    }

    // --- Stats ---
    body.appendChild(this.#renderStatsBody((model as any)?.stats));

    root.appendChild(header);
    root.appendChild(body);

    setCollapsed(root, body, caret, startCollapsed);

    header.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("button")) return;
      const nowCollapsed = !root.classList.contains("smsm-model-collapsed");
      setCollapsed(root, body, caret, nowCollapsed);
    });

    return { root, body, collapsed: startCollapsed };

    function setCollapsed(rootEl: HTMLElement, bodyEl: HTMLElement, caretEl: HTMLElement, collapsed: boolean) {
      rootEl.classList.toggle("smsm-model-collapsed", collapsed);
      bodyEl.style.display = collapsed ? "none" : "block";
      caretEl.textContent = collapsed ? "▸" : "▾";
    }
  }


  #renderStatsBody(stats: SceneModelStats | null | undefined) {
    const wrap = el("div", { className: "smsm-stats" });

    if (!stats) {
      wrap.appendChild(
        el("div", {
          className: "smsm-empty",
          textContent: "No stats available (model.stats is null/undefined).",
        })
      );
      return wrap;
    }

    const rows: Array<[string, string]> = [
      ["SceneObjects", formatNumber(stats.numObjects)],
      ["SceneMeshes", formatNumber(stats.numMeshes)],
      ["SceneGeometries", formatNumber(stats.numGeometries)],
      ["SceneTransforms", formatNumber(stats.numTransforms)],
      ["SceneTextures", formatNumber(stats.numTextures)],
      ["SceneTextureSets", formatNumber(stats.numTextureSets)],
      ["Triangles", formatNumber(stats.numTriangles)],
      ["Lines", formatNumber(stats.numLines)],
      ["Points", formatNumber(stats.numPoints)],
      ["Vertices", formatNumber(stats.numVertices)],
      ["Texture Bytes", formatBytes(stats.textureBytes)],
    ];

    const table = el("table", { className: "smsm-table" });
    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", { textContent: k }));
      tr.appendChild(el("td", { textContent: v }));
      table.appendChild(tr);
    }
    wrap.appendChild(table);

    return wrap;

    function chip(label: string, value: string) {
      const c = el("div", { className: "smsm-chip" });
      c.appendChild(el("div", { className: "smsm-chip-label", textContent: label }));
      c.appendChild(el("div", { className: "smsm-chip-value", textContent: value }));
      return c;
    }
  }

  #setMasterCollapsed(root: HTMLElement, collapsed: boolean) {
    root.classList.toggle("smsm-collapsed", collapsed);

    const body = root.querySelector<HTMLElement>(".smsm-body");
    if (body) body.style.display = collapsed ? "none" : "block";

    const caret = root.querySelector<HTMLElement>("[data-smsm-caret]");
    if (caret) caret.textContent = collapsed ? "▸" : "▾";

    const state = root.querySelector<HTMLElement>("[data-smsm-state]");
    if (state) state.textContent = collapsed ? "Collapsed" : "Expanded";
  }

  #setAllModelsCollapsed(collapsed: boolean) {
    for (const entry of this.#modelPanels.values()) {
      const caret = entry.root.querySelector<HTMLElement>("[data-smsm-model-caret]");
      entry.root.classList.toggle("smsm-model-collapsed", collapsed);
      entry.body.style.display = collapsed ? "none" : "block";
      if (caret) caret.textContent = collapsed ? "▸" : "▾";
      entry.collapsed = collapsed;
    }
  }

  #updateModelCount() {
    if (this.#countEl) this.#countEl.textContent = String(this.#modelPanels.size);
  }


  #getModelId(model: any) {
    return String(model?.id ?? model?.uuid ?? model?._id ?? model?.name ?? "SceneModel");
  }

  #getModelLabel(model: any) {
    const id = this.#getModelId(model);
    const name = model?.name;
    return name && String(name) !== id ? `${name} (${id})` : id;
  }
}

// Helper to render a collapsible CoordinateSystem panel (without JSON button)
function renderCoordSysPanel(cs: any, opts: { collapsed?: boolean; title?: string; jsonTitle?: string } = {}) {
  let collapsed = !!opts.collapsed;

  const root = el("div", { className: "smsm-coordsys-panel" });

  // Caret
  const caret = el("span", {
    className: "smsm-coordsys-caret",
    textContent: collapsed ? "▸" : "▾",
    style: "font-size:16px;width:18px;display:inline-block;text-align:center;color:#444;user-select:none;",
  });

  // Header row: caret + icon + title (no JSON button)
  const header = el("div", {
    className: "smsm-coordsys-header",
    style: "display:flex;align-items:center;gap:10px;cursor:pointer;",
  }, [
    caret,
    el("img", {
      className: "smsm-coordsys-icon",
      width: 32,
      height: 32,
      alt: "Coordinate System",
      src: coordsysIconSvgDataUri(),
      draggable: false,
    }),
    el("div", { className: "smsm-coordsys-title", textContent: opts.title ?? "Coordinate System" }),
    el("div", { style: "flex:1;" }),
    // (No JSON button)
  ]);

  // Panel body (chips + table)
  const body = el("div", {}, [
    el("div", { className: "smsm-coordsys-chips", style: "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;" }, [
      chip("Origin", cs.origin ? cs.origin.map((v: number) => v.toFixed(3)).join(", ") : "—"),
      chip("Units", cs.units ?? "—"),
      chip("Scale to meters", cs.scaleToMeters ?? "—"),
      chip("xUp", cs.xUp ? "true" : "false"),
      chip("yUp", cs.yUp ? "true" : "false"),
      chip("zUp", cs.zUp ? "true" : "false"),
    ]),
    el("table", { className: "smsm-coordsys-table" }, [
      tr("Basis", cs.basis ? cs.basis.map((v: number) => v.toFixed(3)).join(", ") : "—"),
      tr("World Up", cs.worldUp ? cs.worldUp.map((v: number) => v.toFixed(3)).join(", ") : "—"),
      tr("World Right", cs.worldRight ? cs.worldRight.map((v: number) => v.toFixed(3)).join(", ") : "—"),
      tr("World Forward", cs.worldForward ? cs.worldForward.map((v: number) => v.toFixed(3)).join(", ") : "—"),
    ])
  ]);

  // Initial collapsed state
  body.style.display = collapsed ? "none" : "block";

  // Toggle logic
  header.addEventListener("click", (e) => {
    collapsed = !collapsed;
    body.style.display = collapsed ? "none" : "block";
    caret.textContent = collapsed ? "▸" : "▾";
  });

  root.appendChild(header);
  root.appendChild(body);
  return root;
}


// -----------------------------------------------------------------------------
// Small DOM utilities (no framework)
// -----------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: any = {},
  children: Array<Node> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("data-")) {
      node.setAttribute(key, String(value ?? ""));
      continue;
    }
    if (key === "style" && value && typeof value === "object") {
      Object.assign((node as any).style, value);
      continue;
    }
    (node as any)[key] = value;
  }

  for (const child of children) node.appendChild(child);
  return node;
}


function formatNumber(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v ?? "—");
}

function formatBytes(bytes: any) {
  const n = Number(bytes) || 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const dp = i === 0 ? 0 : i === 1 ? 1 : 2;
  return `${v.toFixed(dp)} ${units[i]}`;
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

// -----------------------------------------------------------------------------
// Default CSS
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.smsm-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }
.smsm-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
}
.smsm-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}
.smsm-h1 {
  padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650;
}
.smsm-subtitle {
  font-size: 12px;
  color: #444;
  line-height: 1.35;
}
.smsm-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.smsm-caret { font-size: 14px; color: #444; width: 18px; text-align: center; }
.smsm-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.smsm-btn:hover { background: #fafafa; }
.smsm-btn--sub { padding: 5px 8px; border-radius: 10px; font-size: 11px; }

.smsm-status { display: flex; gap: 8px; align-items: baseline; }
.smsm-status-label { font-size: 12px; color: #666; }
.smsm-status-value { font-size: 12px; font-weight: 400; }

.smsm-body { margin-top: 12px; }
.smsm-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
.smsm-toolbar-left { display: flex; gap: 8px; align-items: baseline; }
.smsm-k { font-size: 12px; color: #666; }
.smsm-v { font-size: 12px; font-weight: 650; }

.smsm-list { display: grid; gap: 10px; }

.smsm-model { border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; }
.smsm-model-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; }
.smsm-model-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.smsm-model-caret { width: 18px; text-align: center; color: #444; }
.smsm-model-name { font-size: 12px; font-weight: 650; word-break: break-word; }
.smsm-model-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

.smsm-model-body { padding: 10px 12px 12px; border-top: 1px solid #f0f0f0; }
.smsm-empty { font-size: 12px; color: #777; }

.smsm-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.smsm-chip { border: 1px solid #e6e6e6; border-radius: 999px; padding: 7px 9px; display: flex; gap: 8px; align-items: baseline; }
.smsm-chip-label { font-size: 11px; color: #666; }
.smsm-chip-value { font-size: 11px; font-weight: 650; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.smsm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.smsm-table th { text-align: left; color: #666; font-weight: 600; width: 160px; padding: 6px 8px; vertical-align: top; }
.smsm-table td { padding: 6px 8px; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.smsm-table tr + tr td, .smsm-table tr + tr th { border-top: 1px solid #f0f0f0; }

.smsm-titleRow { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.smsm-titleRow .smsm-h1 { flex: 1; min-width: 0; }

.smsm-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;body { background: #f7fafc; color: #222; margin: 0; padding: 0; }
    .json-pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px; margin: 0; padding: 18px; background: #fff; border-radius: 10px; }
    .json-key { color: #2d5e8c; }
    .json-string { color: #008000; }
    .json-number { color: #b75501; }
    .json-boolean { color: #b75501; font-weight: bold; }
    .json-null { color: #b75501; font-style: italic; }
  padding: 6px;
}

.scenepanel-viewjson-btn {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 7px;
  border: 1px solid #e6e6e6;
  background: #f7fafc;
  color: #2d5e8c;
  font-weight: 650;
  cursor: pointer;
  margin-left: 12px;
  transition: background 0.13s;
}
.scenepanel-viewjson-btn:hover {
  background: #e6f0fa;
  border-color: #b3c6e0;
}

.smsm-coordsys-panel {
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  background: #f9fafb;
  margin-bottom: 10px;
  padding: 7px 10px;
}

.smsm-coordsys-header {
  margin-bottom: 4px;
  padding: 0;
}

.smsm-coordsys-title {
  font-size: 14px;
  font-weight: 600;
  color: #666;
}

.smsm-coordsys-icon {
  margin-right: 6px;
  width: 24px;
  height: 24px;
}

.smsm-coordsys-chips {
padding-top:6px;
  margin-bottom: 4px;
  font-size: 12px;
  gap: 6px;
}

.smsm-chip {
  background: #eef2f6;
  border-radius: 6px;
  padding: 2px 7px;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.smsm-chip-label {
  color: #888;
  margin-right: 4px;
  font-weight: 500;
}

.smsm-chip-value {
  color: #333;
  font-weight: 600;
}

.smsm-coordsys-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.smsm-coordsys-table th {
  text-align: left;
  color: #666;
  font-weight: 500;
  width: 90px;
  padding: 3px 6px;
  vertical-align: top;
}

.smsm-coordsys-table td {
  padding: 3px 6px;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
`;


function sceneGraphIconDataUri(): string {
  // 60x60, suggestive of geometry, mesh, material
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <defs>
    <linearGradient id="cubeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e0e7ef"/>
      <stop offset="1" stop-color="#b3c6e0"/>
    </linearGradient>
    <radialGradient id="sphereGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff"/>
      <stop offset="1" stop-color="#7ec7e6"/>
    </radialGradient>
    <linearGradient id="triGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe7b3"/>
      <stop offset="1" stop-color="#ffd580"/>
    </linearGradient>
  </defs>
  <!-- Cube (geometry) -->
  <rect x="8" y="28" width="18" height="18" rx="3" fill="url(#cubeGrad)" stroke="#7a8ca3" stroke-width="2"/>
  <!-- Sphere (geometry) -->
  <ellipse cx="40" cy="20" rx="10" ry="10" fill="url(#sphereGrad)" stroke="#5ba6c7" stroke-width="2"/>
  <!-- Triangle (geometry) -->
  <polygon points="32,44 52,54 42,34" fill="url(#triGrad)" stroke="#bfa14a" stroke-width="2"/>
  <!-- Mesh grid (wireframe) -->
  <g stroke="#888" stroke-width="1" opacity="0.7">
    <line x1="8" y1="37" x2="26" y2="37"/>
    <line x1="8" y1="46" x2="26" y2="46"/>
    <line x1="13" y1="28" x2="13" y2="46"/>
    <line x1="21" y1="28" x2="21" y2="46"/>
  </g>
  <!-- Material swatch (color palette) -->
  <rect x="48" y="6" width="8" height="8" rx="2" fill="#e67e22" stroke="#b35c1e" stroke-width="1.2"/>
  <rect x="48" y="16" width="8" height="8" rx="2" fill="#27ae60" stroke="#1e7a43" stroke-width="1.2"/>
  <rect x="48" y="26" width="8" height="8" rx="2" fill="#2980b9" stroke="#1c4e6e" stroke-width="1.2"/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function syntaxHighlightJson(json: string): string {
  json = json.replace(/[&<>]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;'
  }[c] as string));
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) cls = "json-key";
        else cls = "json-string";
      } else if (/true|false/.test(match)) cls = "json-boolean";
      else if (/null/.test(match)) cls = "json-null";
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function compactNumericArraysReplacer(key: string, value: any) {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(v => typeof v === "number" && Number.isFinite(v))
  ) {
    return `[${value.join(",")}]`;
  }
  return value;
}

function openJsonInNewTab(obj: any, title = "SceneModel JSON") {
  // Use custom replacer, then post-process to restore array syntax
  let json = JSON.stringify(obj, compactNumericArraysReplacer, 2);
  // Remove extra quotes around compact arrays
  json = json.replace(/"\[(.*?)\]"/g, "[$1]");
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre {
      background: #0f1116;
      border-radius: 10px;
      margin: 24px 0 24px 24px;
      padding: 24px 32px;
      max-width: 900px;
      font-size: 15px;
      box-shadow: 0 4px 24px #0001;
      color: #e7e7e7;
      text-align: left;
    }
    .json-key { color: #7ec7e6; font-weight: 600; }
    .json-string { color: #ffe7b3; }
    .json-number { color: #b3e6c7; }
    .json-boolean { color: #ffd57a; }
    .json-null { color: #888; }
     h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 0 0 12px 0; }
    .meta { color: #aaa; font-size: 13px; margin-bottom: 18px; }
  </style>
</head>
<body>
      <h1>${escapeHtml(title)}</h1>
            <div class="meta">Serialized to JSON</div>
  <pre class="json-pre">${syntaxHighlightJson(json)}</pre>
</body>
</html>
  `.trim();
  const win = window.open();
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chip(label: string, value: string) {
  return el("div", { className: "smsm-chip" }, [
    el("span", { className: "smsm-chip-label", textContent: label }),
    el("span", { className: "smsm-chip-value", textContent: value }),
  ]);
}

function tr(label: string, value: string) {
  return el("tr", {}, [
    el("th", { textContent: label }),
    el("td", { textContent: value }),
  ]);
}

function coordsysIconSvgDataUri() {
  // Axis gnomon: X (red), Y (green), Z (blue)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <g>
    <!-- X axis (red) -->
    <line x1="14" y1="14" x2="24" y2="14" stroke="#e74c3c" stroke-width="2.2" />
    <polygon points="24,14 21.5,12.7 21.5,15.3" fill="#e74c3c"/>
    <text x="25.5" y="15.5" font-size="7" font-family="sans-serif" fill="#e74c3c" font-weight="bold">X</text>
    <!-- Y axis (green) -->
    <line x1="14" y1="14" x2="14" y2="4" stroke="#27ae60" stroke-width="2.2" />
    <polygon points="14,4 12.7,6.5 15.3,6.5" fill="#27ae60"/>
    <text x="12" y="3.5" font-size="7" font-family="sans-serif" fill="#27ae60" font-weight="bold">Y</text>
    <!-- Z axis (blue, up-right) -->
    <line x1="14" y1="14" x2="6" y2="22" stroke="#2980d9" stroke-width="2.2" />
    <polygon points="6,22 8,21.5 7.5,19.5" fill="#2980d9"/>
    <text x="2.5" y="24" font-size="7" font-family="sans-serif" fill="#2980d9" font-weight="bold">Z</text>
    <!-- Origin dot -->
    <circle cx="14" cy="14" r="2.2" fill="#888" stroke="#fff" stroke-width="1"/>
  </g>
</svg>
  `.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
