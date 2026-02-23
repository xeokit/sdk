// File: packages/sdk/src/demo/TilesPanel.ts

import type { RenderStats } from "../../webglrenderer/internal/inspectors/RenderStats";
import type { TileStats } from "../../webglrenderer/internal/inspectors/TileStats";
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

  static show(flowHost: HTMLDivElement, renderStats: RenderStats, opts: any = {}) {
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
    const tiles: TileStats[] = Object.values(renderStats.tiles || {});
    const root = el("div", { className: "tilespanel-root" });
    root.appendChild(this.renderHeader(tiles));
    root.appendChild(this.renderStatsRow(tiles.length));
    root.appendChild(this.renderBody(renderStats));
    return root;
  }

  static renderHeader(tiles: TileStats[]) {
    // Header: icon | title/subtitle | spacer | actions (JSON button, styled like DataPanel/ScenePanel)
    return el("div", { className: "tilespanel-header", style: "display:flex;align-items:flex-start;" }, [
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
        el("div", { className: "tilespanel-subtitle", textContent: "Visualize GPUTile boundaries." }),
      ]),
      el("div", { style: "flex:1;" }), // Spacer to push actions to the right
      el("div", {
        className: "tilespanel-actions",
        style: "display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;"
      }, [
        el("button", {
          className: "datapanel-viewjson-btn",
          textContent: "JSON",
          title: "View all GPUTiles as JSON",
          onclick: (e: MouseEvent) => {
            e.stopPropagation();
            openTilesJsonInNewTab(tiles, "GPUTiles JSON");
          }
        })
      ])
    ]);
  }

  static renderStatsRow(tileCount: number) {
    return el("div", { className: "tilespanel-status-row" }, [
      el("span", { className: "tilespanel-status-label", textContent: "GPUTiles:" }),
      el("span", { className: "tilespanel-status-value", textContent: String(tileCount) }),
    ]);
  }

  static renderBody(renderStats: RenderStats) {
    const tiles: TileStats[] = Object.values(renderStats.tiles || {});
    if (!tiles.length) return el("div", { textContent: "No tile stats available." });

    // Get tile size (assume uniform)
    const tileSize = tiles[0]?.size ?? 200;

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
      { label: "Top view", ax0: 0, ax1: 2, axes: "X,Z" },
      { label: "Front view", ax0: 0, ax1: 1, axes: "X,Y" },
      { label: "Side view", ax0: 1, ax1: 2, axes: "Y,Z" }
    ];

    const sections = views.map(view => {
      const svg = this.renderSVGView(tiles, tileSize, min, max, view.ax0, view.ax1);
      // Collapsible section, initially collapsed
      const details = el("details", { className: "tilespanel-section" }, [
        el("summary", { className: "tilespanel-section-summary" }, [
          el("span", { className: "tilespanel-caret" }, ["▸"]),
          `${view.label} [${view.axes}]`
        ]),
        el("div", { className: "tilespanel-svgwrap" }, [svg])
      ]);
      // All sections start collapsed
      // @ts-ignore
      details.open = false;
      // Caret rotation on toggle
      details.addEventListener("toggle", () => {
        const caret = details.querySelector<HTMLElement>(".tilespanel-caret");
        if (caret) {
          // @ts-ignore
          if (details.open) caret.classList.add("tilespanel-caret--open");
          else caret.classList.remove("tilespanel-caret--open");
        }
      });
      return details;
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
    // Compute min/max extents for the selected axes, using tile AABBs
    let min0 = Infinity, min1 = Infinity, max0 = -Infinity, max1 = -Infinity;
    for (const t of tiles) {
      const c0 = t.rtcCenter[ax0], c1 = t.rtcCenter[ax1];
      const half = tileSize / 2;
      min0 = Math.min(min0, c0 - half);
      max0 = Math.max(max0, c0 + half);
      min1 = Math.min(min1, c1 - half);
      max1 = Math.max(max1, c1 + half);
    }

    // Add padding in world units
    const pad = tileSize * 1.5;
    min0 -= pad;
    min1 -= pad;
    max0 += pad;
    max1 += pad;

    // SVG display size (pixels)
    const W = 720, H = 720;

    // Color palette
    const palette = ["#6ab04c", "#22a6b3", "#f0932b", "#eb4d4b", "#be2edd", "#4834d4", "#f6e58d", "#7ed6df"];

    // SVG elements
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", `${min0} ${min1} ${max0 - min0} ${max1 - min1}`);
    svg.classList.add("tilespanel-svg");

    // Scene AABB border (full extents)
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", String(min0));
    rect.setAttribute("y", String(min1));
    rect.setAttribute("width", String(max0 - min0));
    rect.setAttribute("height", String(max1 - min1));
    rect.setAttribute("fill", "#fff");
    rect.setAttribute("stroke", "#b3c6e0");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(rect);

    // Tiles (rectangles only, no labels)
    tiles.forEach((tile, i) => {
      const tileSize = tile.size;
      const c0 = tile.rtcCenter[ax0], c1 = tile.rtcCenter[ax1];
      const half = tileSize / 2;
      const x = c0 - half;
      const y = c1 - half;

      // Draw tile rectangle at true size
      const tileRect = document.createElementNS(svgNS, "rect");
      tileRect.setAttribute("x", String(x));
      tileRect.setAttribute("y", String(y));
      tileRect.setAttribute("width", String(tileSize));
      tileRect.setAttribute("height", String(tileSize));
      tileRect.setAttribute("fill", palette[i % palette.length]);
      tileRect.setAttribute("fill-opacity", "0.18");
      tileRect.setAttribute("stroke", palette[i % palette.length]);
      tileRect.setAttribute("stroke-width", "2.5");
      tileRect.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(tileRect);
    });
//
//     // --- Extents labels ---
//     // Min label (lower left)
//     const minLabel = document.createElementNS(svgNS, "text");
//     minLabel.setAttribute("x", String(min0 + tileSize * 0.2));
//     minLabel.setAttribute("y", String(max1 - tileSize * 0.2));
//     minLabel.setAttribute("class", "tilespanel-extentslabel");
//     minLabel.setAttribute("font-size", "12"); // px, fixed
//     minLabel.setAttribute("vector-effect", "non-scaling-stroke");
//     minLabel.textContent = `min: ${min0.toFixed(3)}, ${min1.toFixed(3)}`;
//     svg.appendChild(minLabel);
//
// // Max label (upper right)
//     const maxLabel = document.createElementNS(svgNS, "text");
//     maxLabel.setAttribute("x", String(max0 - tileSize * 0.2));
//     maxLabel.setAttribute("y", String(min1 + tileSize * 0.8));
//     maxLabel.setAttribute("class", "tilespanel-extentslabel");
//     maxLabel.setAttribute("text-anchor", "end");
//     maxLabel.setAttribute("font-size", "12"); // px, fixed
//     maxLabel.setAttribute("vector-effect", "non-scaling-stroke");
//     maxLabel.textContent = `max: ${max0.toFixed(3)}, ${max1.toFixed(3)}`;
//     svg.appendChild(maxLabel);

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
.tilespanel-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px; /* reduced from 12px or more */
}
.tilespanel-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border: 1px solid #e6e6e6; border-radius: 12px; overflow: hidden; }
.tilespanel-table th { text-align: left; color: #666; font-weight: 650; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
.tilespanel-table td { padding: 8px 10px; border-top: 1px solid #f7f7f7; vertical-align: top; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.tilespanel-empty { color: #888; font-size: 13px; text-align: center; }

.tilespanel-section {
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
  margin-bottom: 0; /* reduced from 12px */
  overflow: hidden;
}
.tilespanel-section-summary {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #2d5e8c;
  background: #f7fafc;
  border-radius: 12px 12px 0 0;
  padding: 12px 18px 10px 18px;
  user-select: none;
  letter-spacing: 0.01em;
  transition: background 0.13s;
  outline: none;
}
.tilespanel-section-summary:hover {
  background: #e6f0fa;
}
.tilespanel-caret {
  display: inline-block;
  width: 18px;
  text-align: center;
  font-size: 15px;
  color: #888;
  transition: transform 0.18s cubic-bezier(.4,0,.2,1), color 0.13s;
  user-select: none;
  margin-right: 4px;
  vertical-align: middle;
}
.tilespanel-caret--open {
  transform: rotate(90deg);
  color: #4a90e2;
}
.tilespanel-status-row {
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 12px;
  color: #2d5e8c;
  font-weight: 650;
  margin: 10px 0 8px 0;
  padding-left: 0;
}
.tilespanel-status-label {
  font-size: 12px;
  color: #666;
  font-weight:normal;
}
.tilespanel-status-value {
  font-size: 12px;
  font-weight: 600;
  color: #444;
}
.tilespanel-svgwrap { padding: 18px; }
.tilespanel-svg { width: 100%; height: auto; display: block; background: #f7fafc; border-radius: 10px; }
.tilespanel-tilelabel { font-size: 12px; fill: #222; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.tilespanel-extentslabel { font-size: 11px; fill: #888; }
.json-key { color: #8ec07c; }
.json-string { color: #b8bb26; }
.json-number { color: #fabd2f; }
.json-boolean { color: #83a598; }
.json-null { color: #fe8019; }
`;
    document.head.appendChild(style);
  }
}


function syntaxHighlightJson(json: string): string {
  json = json.replace(/[&<>]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
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

function openTilesJsonInNewTab(tiles: TileStats[], title = "GPUTiles JSON") {
  let json = JSON.stringify(tiles, null, 2);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre { background: #0f1116; border-radius: 10px; margin: 24px 0 24px 24px; padding: 24px 32px; max-width: 900px; font-size: 15px; box-shadow: 0 4px 24px #0001; color: #e7e7e7; text-align: left; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 0 0 12px 0; }
    .meta { color: #aaa; font-size: 13px; margin-bottom: 18px; }
    .json-key { color: #8ec07c; }
    .json-string { color: #b8bb26; }
    .json-number { color: #fabd2f; }
    .json-boolean { color: #83a598; }
    .json-null { color: #fe8019; }
  </style>
</head>
<body>
  <h1>${title}</h1>
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
