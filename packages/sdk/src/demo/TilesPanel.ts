// File: packages/sdk/src/demo/TilesPanel.ts

import type { RenderStats } from "../webglrenderer/internal/inspectors/RenderStats";
import type { TileStats } from "../webglrenderer/internal/inspectors/TileStats";
import { FloatingPanelFlowHost } from "./FloatingPanelFlowHost";


// Small DOM util
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, any> | null,
  children?: (HTMLElement | string | SVGElement)[]
): HTMLElement {
  const elem = document.createElement(tag);
  if (props) {
    for (const k in props) {
      if (k === "className") elem.className = props[k];
      else if (k === "textContent") elem.textContent = props[k];
      else if (k === "onclick") elem.onclick = props[k];
      else elem.setAttribute(k, props[k]);
    }
  }
  if (children) {
    for (const c of children) elem.append(c as any);
  }
  return elem;
}

function tilesPanelIconDataUri(): string {
  // 60x60 SVG: 3D cube (scene AABB) with inner colored cubes (object AABBs)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <!-- Shadow -->
  <ellipse cx="30" cy="52" rx="18" ry="6" fill="#222" opacity="0.13"/>
  <!-- Main cube (scene AABB) -->
  <g>
    <polygon points="15,40 30,50 45,40 30,30" fill="#eaf6ff" stroke="#4a90e2" stroke-width="2"/>
    <polygon points="15,40 30,30 30,10 15,20" fill="#eaf6ff" stroke="#4a90e2" stroke-width="2"/>
    <polygon points="30,10 45,20 45,40 30,30" fill="#eaf6ff" stroke="#4a90e2" stroke-width="2"/>
    <polygon points="15,20 30,10 45,20 30,30" fill="#eaf6ff" stroke="#4a90e2" stroke-width="2"/>
  </g>
  <!-- Inner cubes (object AABBs) -->
  <g>
    <polygon points="22,36 30,41 38,36 30,31" fill="#c9a7ff" stroke="#a07be0" stroke-width="1.2"/>
    <polygon points="22,36 30,31 30,21 22,26" fill="#c9a7ff" stroke="#a07be0" stroke-width="1.2"/>
    <polygon points="30,21 38,26 38,36 30,31" fill="#c9a7ff" stroke="#a07be0" stroke-width="1.2"/>
    <polygon points="22,26 30,21 38,26 30,31" fill="#c9a7ff" stroke="#a07be0" stroke-width="1.2"/>
  </g>
  <g>
    <polygon points="35,28 39,30 43,28 39,26" fill="#27ae60" stroke="#219150" stroke-width="1.2"/>
    <polygon points="35,28 39,26 39,22 35,24" fill="#27ae60" stroke="#219150" stroke-width="1.2"/>
    <polygon points="39,22 43,24 43,28 39,26" fill="#27ae60" stroke="#219150" stroke-width="1.2"/>
    <polygon points="35,24 39,22 43,24 39,26" fill="#27ae60" stroke="#219150" stroke-width="1.2"/>
  </g>
  <!-- Frame border -->
  <rect x="4" y="4" width="52" height="52" rx="12" fill="none" stroke="#e6e6e6" stroke-width="1.5"/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class TilesPanel {

  static #TILE_ID = "__tilesinsp_tile__";
  static #STYLE_ID = "__tilesinsp_style__";

  static show(flowHost: HTMLDivElement, renderStats:RenderStats, opts: any = {}) {

    this.#ensureGlobalStyle();

    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;

    const root = this.render(renderStats, opts);

    if (!tile) {
      tile = FloatingPanelFlowHost.mountTile(root, {
        tileMinWidth: opts.tileMinWidth ?? opts.maxWidth ?? 760,
        tileMaxWidth: opts.tileMaxWidth ?? opts.maxWidth ?? 760
      }) as HTMLDivElement;
      tile.id = this.#TILE_ID;
      flowHost.appendChild(tile);
    } else {
      tile.replaceChildren(root);
    }

    return tile;
  }

  static render(renderStats: RenderStats, opts: any = {}) {
    const root = el("div", { className: "tilespanel-root" });
    root.appendChild(this.renderHeader());
    root.appendChild(this.renderBody(renderStats));
    return root;
  }

  static renderHeader() {
    return el("div", { className: "tilespanel-header" }, [
      el("img", {
        className: "tilespanel-title-icon",
        width: 60,
        height: 60,
        alt: "Tiles",
        src: tilesPanelIconDataUri(),
        draggable: false,
      }),
      el("div", { className: "tilespanel-title-col" }, [
        el("div", { className: "tilespanel-h1", textContent: "Tiles" }),
        el("div", { className: "tilespanel-subtitle", textContent: "Snapshot of RTC Tile boundaries from three axes." }),
      ]),
    ]);
  }

  static renderBody(renderStats: RenderStats) {
    const tiles: TileStats[] = Object.values(renderStats.tiles || {});
    if (!tiles.length) return el("div", { textContent: "No tile stats available." });

    // Get tile size (assume uniform)
    const tileSize = tiles[0]?.tileSize ?? 200;

    // Compute scene AABB from all tiles
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const t of tiles) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], t.rtcCenter[i] - tileSize / 2);
        max[i] = Math.max(max[i], t.rtcCenter[i] + tileSize / 2);
      }
    }

    // Views: [label, ax0, ax1, axes]
    const views: Array<{ label: string, ax0: number, ax1: number, axes: string }> = [
      { label: "Top (XZ)", ax0: 0, ax1: 2, axes: "X,Z" },
      { label: "Front (XY)", ax0: 0, ax1: 1, axes: "X,Y" },
      { label: "Side (YZ)", ax0: 1, ax1: 2, axes: "Y,Z" }
    ];

    const sections = views.map(view => {
      const svg = this.renderSVGView(tiles, tileSize, min, max, view.ax0, view.ax1);
      return el("details", { className: "tilespanel-section", open: true }, [
        el("summary", { className: "tilespanel-section-summary" }, [
          el("span", { className: "tilespanel-caret" }, ["▸"]),
          `${view.label} [${view.axes}]`
        ]),
        el("div", { className: "tilespanel-svgwrap" }, [svg])
      ]);
    });

    return el("div", { className: "tilespanel-body" }, sections);
  }

  static renderSVGView(
    tiles: TileStats[],
    tileSize: number,
    min: number[],
    max: number[],
    ax0: number,
    ax1: number
  ) {
    // SVG size
    const W = 720, H = 720, PAD = 54;

    // Compute max span for uniform scaling
    const span0 = max[ax0] - min[ax0] || 1;
    const span1 = max[ax1] - min[ax1] || 1;
    const maxSpan = Math.max(span0, span1);

    // Expand both axes to maxSpan, centered
    let min0 = min[ax0], max0 = max[ax0];
    let min1 = min[ax1], max1 = max[ax1];
    if (span0 < maxSpan) {
      const mid = (min0 + max0) / 2;
      min0 = mid - maxSpan / 2;
      max0 = mid + maxSpan / 2;
    }
    if (span1 < maxSpan) {
      const mid = (min1 + max1) / 2;
      min1 = mid - maxSpan / 2;
      max1 = mid + maxSpan / 2;
    }

    // Map world coords to SVG
    const toSvg = (v0: number, v1: number) => [
      PAD + ((v0 - min0) / (max0 - min0)) * (W - PAD * 2),
      H - PAD - ((v1 - min1) / (max1 - min1)) * (H - PAD * 2)
    ];

    // Color palette
    const palette = ["#6ab04c", "#22a6b3", "#f0932b", "#eb4d4b", "#be2edd", "#4834d4", "#f6e58d", "#7ed6df"];

    // SVG elements
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.classList.add("tilespanel-svg");

    // Scene AABB border
    const [sx, sy] = toSvg(min0, min1);
    const [ex, ey] = toSvg(max0, max1);
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", String(Math.min(sx, ex)));
    rect.setAttribute("y", String(Math.min(sy, ey)));
    rect.setAttribute("width", String(Math.abs(ex - sx)));
    rect.setAttribute("height", String(Math.abs(ey - sy)));
    rect.setAttribute("fill", "#fff");
    rect.setAttribute("stroke", "#b3c6e0");
    rect.setAttribute("stroke-width", "2");
    svg.appendChild(rect);

    // Tiles
    tiles.forEach((tile, i) => {
      // Tile AABB in this view
      const c0 = tile.rtcCenter[ax0], c1 = tile.rtcCenter[ax1];
      const half = tileSize / 2;
      const minTile0 = c0 - half, maxTile0 = c0 + half;
      const minTile1 = c1 - half, maxTile1 = c1 + half;
      const [tx0, ty0] = toSvg(minTile0, minTile1);
      const [tx1, ty1] = toSvg(maxTile0, maxTile1);

      // Draw tile rectangle
      const tileRect = document.createElementNS(svgNS, "rect");
      tileRect.setAttribute("x", String(Math.min(tx0, tx1)));
      tileRect.setAttribute("y", String(Math.min(ty0, ty1)));
      tileRect.setAttribute("width", String(Math.abs(tx1 - tx0)));
      tileRect.setAttribute("height", String(Math.abs(ty1 - ty0)));
      tileRect.setAttribute("fill", palette[i % palette.length]);
      tileRect.setAttribute("fill-opacity", "0.18");
      tileRect.setAttribute("stroke", palette[i % palette.length]);
      tileRect.setAttribute("stroke-width", "2.5");
      svg.appendChild(tileRect);

      // Label at center
      const [cx, cy] = toSvg(c0, c1);
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", String(cx));
      label.setAttribute("y", String(cy));
      label.setAttribute("class", "tilespanel-tilelabel");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      label.textContent =
        `tileIndex: ${tile.tileIndex}\nid: ${tile.id}\nmeshes: ${tile.numMeshes}\nrtcCenter: [${tile.rtcCenter.map(v => v.toFixed(2)).join(", ")}]`;
      svg.appendChild(label);
    });

    // --- Extents labels ---
    // Min label (lower left)
    const minLabel = document.createElementNS(svgNS, "text");
    minLabel.setAttribute("x", String(PAD + 6));
    minLabel.setAttribute("y", String(H - PAD - 8));
    minLabel.setAttribute("class", "tilespanel-extentslabel");
    minLabel.textContent = `min: ${min0.toFixed(3)}, ${min1.toFixed(3)}`;
    svg.appendChild(minLabel);

    // Max label (upper right)
    const maxLabel = document.createElementNS(svgNS, "text");
    maxLabel.setAttribute("x", String(W - PAD - 6));
    maxLabel.setAttribute("y", String(PAD + 22));
    maxLabel.setAttribute("class", "tilespanel-extentslabel");
    maxLabel.setAttribute("text-anchor", "end");
    maxLabel.textContent = `max: ${max0.toFixed(3)}, ${max1.toFixed(3)}`;
    svg.appendChild(maxLabel);

    return svg;
  }

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = this.#STYLE_ID;
    style.textContent = `
.tilespanel-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }
.tilespanel-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
  margin-bottom: 12px;
}
.tilespanel-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}
.tilespanel-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}
.tilespanel-h1 { padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650; }
.tilespanel-subtitle { font-size: 12px; color: #444; line-height: 1.35; }
.tilespanel-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.tilespanel-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.tilespanel-btn:hover { background: #fafafa; }
.tilespanel-btn--sub { padding: 5px 8px; border-radius: 10px; font-size: 11px; }
.tilespanel-body { margin-top: 12px; }
.tilespanel-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border: 1px solid #e6e6e6; border-radius: 12px; overflow: hidden; }
.tilespanel-table th { text-align: left; color: #666; font-weight: 650; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
.tilespanel-table td { padding: 8px 10px; border-top: 1px solid #f7f7f7; vertical-align: top; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.tilespanel-empty { color: #888; font-size: 13px; text-align: center; }
    `;
    document.head.appendChild(style);
  }
}
