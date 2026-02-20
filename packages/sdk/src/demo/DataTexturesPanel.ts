
import type { DataTextures } from "../webglrenderer/internal/gpuMemoryManager/DataTextures";

// Small DOM util
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, any> | null,
  children?: (HTMLElement | string | SVGElement)[]
): HTMLElement {
  const e = document.createElement(tag);
  if (props) for (const k in props) (e as any)[k] = props[k];
  if (children) for (const c of children) e.append(c);
  return e;
}

export class DataTexturesPanel {

  static #TILE_ID = "__dtxpanel_tile__";
  static #STYLE_ID = "__dtxpanel_style__";

  static show(flowHost: HTMLElement, dataTextures: DataTextures) {
    this.#ensureStyle();
    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;
    if (!tile) {
      tile = document.createElement("div");
      tile.id = this.#TILE_ID;
      tile.className = "taskpanel-root";
      flowHost.appendChild(tile);
    }
    tile.innerHTML = "";
    tile.appendChild(this.render(dataTextures));
  }

  static render(dataTextures: DataTextures, opts: any = {}) {
    const root = el("div", { className: "taskpanel-root" });
    root.appendChild(this.renderHeader(dataTextures, opts));
    root.appendChild(this.renderBody(dataTextures));
    return root;
  }

  static renderHeader(dataTextures: DataTextures, opts: any = {}) {
    return el("div", { className: "datatextures-header" }, [
      el("img", {
        className: "shins-title-icon",
        width: 60,
        height: 60,
        alt: "Shader icon",
        src: this.icon(),
        draggable: false,
      }),
      el("div", { className: "datatextures-title-col" }, [
        el("div", { className: "datatextures-h1", textContent: "Tasks" }),
        el("div", { className: "datatextures-subtitle", textContent: "All SDKTask instances currently running in the SDKTaskRunner. These are frozen while this inspector is open." }),
      ])
    ]);
  }

  static renderBody(dataTextures: DataTextures) {
    const root = el("div", { className: "datatextures-root" });

    // Summary
    root.append(
      el("div", { className: "datatextures-summary" }, [
        el("div", { className: "datatextures-summary-row" }, [
          el("span", { className: "datatextures-summary-label" }, "Tiles: "),
          String(dataTextures.numTiles),
        ]),
        el("div", { className: "datatextures-summary-row" }, [
          el("span", { className: "datatextures-summary-label" }, "Batches: "),
          String(dataTextures.batches.length),
        ]),
        el("div", { className: "datatextures-summary-row" }, [
          el("span", { className: "datatextures-summary-label" }, "Views: "),
          String(dataTextures.viewTileCameraMatrixTexture.length),
        ]),
      ])
    );

    // Global per-view textures
    root.append(
      el("div", { className: "datatextures-section" }, [
        el("div", { className: "datatextures-section-title" }, "Global Per-View Textures"),
        this.renderTextureTable([
          {
            name: "viewTileCameraMatrixTexture",
            arr: dataTextures.viewTileCameraMatrixTexture,
          },
          {
            name: "viewTilePickMatrixTexture",
            arr: dataTextures.viewTilePickMatrixTexture,
          },
        ]),
      ])
    );

    // Per-batch textures
    dataTextures.batches.forEach((batch, batchIdx) => {
      const details = document.createElement("details");
      details.open = false;
      details.className = "datatextures-batch-section";
      const summary = document.createElement("summary");
      summary.className = "datatextures-batch-summary";
      summary.append(
        el("span", { className: "datatextures-caret" }, "▸"),
        ` Batch ${batchIdx}`
      );
      details.appendChild(summary);

      // Per-batch textures
      details.appendChild(
        el("div", { className: "datatextures-batch-tablewrap" }, [
          this.renderTextureTable(
            Object.entries(batch)
              .filter(([k, v]) => Array.isArray(v) === false && typeof v === "object" && v && typeof v.getItem === "function")
              .map(([k, v]) => ({ name: k, arr: [v] }))
          ),
        ])
      );

      // Per-view textures in batch
      if (Array.isArray(batch.views)) {
        batch.views.forEach((view, viewIdx) => {
          const vdetails = document.createElement("details");
          vdetails.open = false;
          vdetails.className = "datatextures-view-section";
          const vsummary = document.createElement("summary");
          vsummary.className = "datatextures-view-summary";
          vsummary.append(
            el("span", { className: "datatextures-caret" }, "▸"),
            ` View ${viewIdx}`
          );
          vdetails.appendChild(vsummary);

          vdetails.appendChild(
            el("div", { className: "datatextures-view-tablewrap" }, [
              this.renderTextureTable(
                Object.entries(view)
                  .filter(([k, v]) => v && typeof v.getItem === "function")
                  .map(([k, v]) => ({ name: k, arr: [v] }))
              ),
            ])
          );
          details.appendChild(vdetails);
        });
      }

      root.appendChild(details);
    });

    return root;
  }

  static renderTextureTable(items: { name: string, arr: any[] }[]) {
    const table = el("table", { className: "datatextures-table" });
    const thead = el("thead", null, [
      el("tr", null, [
        el("th", null, "Name"),
        el("th", null, "Type"),
        el("th", null, "Shape"),
        el("th", null, "Count"),
      ]),
    ]);
    table.appendChild(thead);
    const tbody = el("tbody");
    for (const { name, arr } of items) {
      arr.forEach((tex: any) => {
        let type = tex?.constructor?.name ?? "";
        let shape = "";
        let count = "";
        if (tex && typeof tex.getShape === "function") {
          try {
            const s = tex.getShape();
            if (Array.isArray(s)) shape = s.join("×");
          } catch {}
        }
        if (tex && typeof tex.length === "number") count = String(tex.length);
        else if (tex && typeof tex.getCount === "function") {
          try { count = String(tex.getCount()); } catch {}
        }
        table.appendChild(
          el("tr", null, [
            el("td", null, name),
            el("td", null, type),
            el("td", null, shape),
            el("td", null, count),
          ])
        );
      });
    }
    table.appendChild(tbody);
    return table;
  }

  static icon() {
    // 60x60 SVG: 3D grid/cube with colored layers, suggestive of GPU data textures
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <ellipse cx="30" cy="52" rx="18" ry="6" fill="#222" opacity="0.13"/>
  <g>
    <polygon points="15,45 45,45 55,35 25,35" fill="#e3f0fa" stroke="#7db3e6" stroke-width="2"/>
    <polygon points="15,45 25,35 25,15 15,25" fill="#c6e2f7" stroke="#7db3e6" stroke-width="2"/>
    <polygon points="45,45 55,35 55,15 45,25" fill="#b2d6f3" stroke="#7db3e6" stroke-width="2"/>
    <polygon points="15,25 25,15 45,15 55,15 45,25 25,25" fill="#e3f0fa" stroke="#7db3e6" stroke-width="2"/>
    <rect x="22" y="22" width="16" height="6" fill="#7db3e6" opacity="0.7" rx="2"/>
    <rect x="22" y="32" width="16" height="6" fill="#7db3e6" opacity="0.5" rx="2"/>
    <rect x="22" y="42" width="16" height="6" fill="#7db3e6" opacity="0.3" rx="2"/>
  </g>
  <rect x="4" y="4" width="52" height="52" rx="12" fill="none" stroke="#e6e6e6" stroke-width="1.5"/>
</svg>`.trim();
    return el("img", {
      className: "datatextures-title-icon",
      width: 60,
      height: 60,
      alt: "DataTextures",
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      draggable: false,
    });
  }

  static #ensureStyle() {
    if ((window as any).__datatextures_panel_style) return;
    const style = document.createElement("style");
    style.textContent = `
.datatextures-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }
.datatextures-title-icon { width: 60px; height: 60px; flex: 0 0 60px; border-radius: 14px; border: 1.5px solid #e6e6e6; background: #fafafa; padding: 6px; }
.datatextures-summary { display: flex; gap: 32px; margin-bottom: 18px; }
.datatextures-summary-row { font-size: 15px; }
.datatextures-summary-label { color: #2d5e8c; font-weight: 650; }
.datatextures-section { margin-bottom: 18px; }
.datatextures-section-title { font-size: 16px; font-weight: 650; color: #2d5e8c; margin-bottom: 8px; }
.datatextures-table { border-collapse: collapse; width: 100%; font-size: 14px; margin-bottom: 8px; }
.datatextures-table th, .datatextures-table td { border: 1px solid #e6e6e6; padding: 4px 10px; }
.datatextures-table th { background: #f7fafc; color: #2d5e8c; font-weight: 650; }
.datatextures-batch-section, .datatextures-view-section { border: 1px solid #e6e6e6; border-radius: 10px; background: #fff; margin-bottom: 12px; }
.datatextures-batch-summary, .datatextures-view-summary { cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 650; color: #2d5e8c; padding: 10px 14px 8px 14px; user-select: none; outline: none; }
.datatextures-caret { font-size: 16px; color: #888; transition: transform 0.18s cubic-bezier(.4,0,.2,1); display: inline-block; width: 18px; text-align: center; }
.datatextures-batch-section[open] > .datatextures-batch-summary > .datatextures-caret,
.datatextures-view-section[open] > .datatextures-view-summary > .datatextures-caret { transform: rotate(90deg); }
.datatextures-batch-tablewrap, .datatextures-view-tablewrap { padding: 0 14px 10px 14px; }
    `;
    document.head.appendChild(style);
    (window as any).__datatextures_panel_style = true;
  }
}
