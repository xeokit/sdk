
import type { SceneCollisionIndex } from "../../collision";
import { FloatingPanelFlowHost } from "./FloatingPanelFlowHost";
import {View} from "../../viewer";
import type {Vec3} from "../../math/vector";
import type {AABB3} from "../../math/boundaries";

function boundariesPanelIconDataUri(): string {
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

/**
 * Panel for visualizing a SceneCollisionIndex snapshot. Shows the bounding boxes of all objects in the scene from
 * three orthogonal views (top, front, side).
 */
export class BoundariesPanel {
  static #TILE_ID = "__sceneaabb3index_tile__";
  static #STYLE_ID = "__sceneaabb3index_style__";

  static show(flowHost: HTMLDivElement, view: View, index: SceneCollisionIndex, opts: any = {}) {
    this.#ensureGlobalStyle();
    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;
    const root = this.render(view, index, opts);
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

  static render(view: View, index: SceneCollisionIndex, opts: any = {}) {
    const root = el("div", { className: "sceneaabb3index-root" });
    root.appendChild(this.renderHeader());
    root.appendChild(this.renderBody(view, index));
    return root;
  }

  static renderHeader() {
    return el("div", { className: "sceneaabb3index-header" }, [
      el("img", {
        className: "sceneaabb3index-title-icon",
        width: 60,
        height: 60,
        alt: "Boundaries",
        src: boundariesPanelIconDataUri(),
        draggable: false,
      }),
      el("div", { className: "sceneaabb3index-title-col" }, [
        el("div", { className: "sceneaabb3index-h1", textContent: "Boundaries" }),
        el("div", { className: "sceneaabb3index-subtitle", textContent: "Snapshot of SceneObject axis-aligned bounding boxes (AABBs) from three axes." }),
      ]),
    ]);
  }

  static renderBody(view: View, index: SceneCollisionIndex) {
    const scene = index.scene;
    const cs = scene.coordinateSystem;
    const body = el("div", { className: "sceneaabb3index-body" });
    const aabbs = [];
    for (const object of Object.values(scene.objects)) {
      if (object.meshes.length > 0) {
        aabbs.push({ id: object.id, aabb: index.getObjectAABB(object.id) });
      }
    }
    const sceneAABB = index.getSceneAABB();
    if (!sceneAABB) {
      // Empty scene — nothing meaningful to render.
      body.appendChild(el("div", { className: "sceneaabb3index-extentspin" }, ["Scene AABB: (empty scene)"]));
      return body;
    }

    // Scene AABB label
    const extentsLabel = el("div", { className: "sceneaabb3index-extentspin" }, [
      "Scene AABB: ",
      sceneAABB[0].toFixed(3), ", ",
      sceneAABB[1].toFixed(3), ", ",
      sceneAABB[2].toFixed(3), ", ",
      sceneAABB[3].toFixed(3), ", ",
      sceneAABB[4].toFixed(3), ", ",
      sceneAABB[5].toFixed(3)
    ]);
    body.appendChild(extentsLabel);

    // Camera params from first view
    const cam = view.camera;
    const camEye = cam.eye;
    const camLook = cam.look;

    // Coordinate system axes
    function axisIndex(vec: Vec3) {
      for (let i = 0; i < 3; ++i) if (Math.abs(vec[i]) > 0.5) return i;
      return 1;
    }
    const upAxis = axisIndex(cs.worldUp);
    const rightAxis = axisIndex(cs.worldRight);
    const forwardAxis = axisIndex(cs.worldForward);

    // Compose the three views: [label, ax0, ax1]
    const views: Array<{ label: string, ax0: number, ax1: number }> = [
      { label: "Top",   ax0: rightAxis,   ax1: forwardAxis },
      { label: "Front", ax0: rightAxis,   ax1: upAxis },
      { label: "Side",  ax0: forwardAxis, ax1: upAxis }
    ];

    // Collapsible sections for each view
    const sections = views.map(viewInfo => {
      const svg = BoundariesPanel.renderSVGView(
        aabbs, sceneAABB, viewInfo.ax0, viewInfo.ax1, camEye, camLook
      );
      const details: any = el("details", { className: "sceneaabb3index-section" }, [
        el("summary", { className: "sceneaabb3index-section-summary" }, [
          el("span", { className: "sceneaabb3index-caret" }, ["▸"]),
          `${viewInfo.label} view`
        ]),
        el("div", { className: "sceneaabb3index-svgwrap" }, [svg])
      ]);
      details.open = false;
      details.addEventListener("toggle", () => {
        const caret = details.querySelector(".sceneaabb3index-caret");
        if (caret) {
          if (details.open) caret.classList.add("sceneaabb3index-caret--open");
          else caret.classList.remove("sceneaabb3index-caret--open");
        }
      });
      return details;
    });

    body.append(...sections);
    return body;
  }

  static renderSVGView(
    aabbs: { id: string, aabb: AABB3 }[],
    sceneAABB: AABB3,
    ax0: number,
    ax1: number,
    camEye: Vec3,
    camLook: Vec3
  ) {
    // Make SVG 1.5x larger
    const W = 720, H = 720, PAD = 54;

    // Scene bounds for all axes
    const minX = sceneAABB[0], maxX = sceneAABB[3];
    const minY = sceneAABB[1], maxY = sceneAABB[4];
    const minZ = sceneAABB[2], maxZ = sceneAABB[5];
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const spanZ = maxZ - minZ || 1;
    const maxSpan = Math.max(spanX, spanY, spanZ);

    // For this view, axes ax0 and ax1
    let min0 = sceneAABB[ax0], max0 = sceneAABB[ax0 + 3];
    let min1 = sceneAABB[ax1], max1 = sceneAABB[ax1 + 3];
    let span0 = max0 - min0 || 1;
    let span1 = max1 - min1 || 1;

    // Expand both axes to maxSpan, centered
    if (span0 < maxSpan) {
      const mid0 = (min0 + max0) / 2;
      min0 = mid0 - maxSpan / 2;
      max0 = mid0 + maxSpan / 2;
      span0 = maxSpan;
    }
    if (span1 < maxSpan) {
      const mid1 = (min1 + max1) / 2;
      min1 = mid1 - maxSpan / 2;
      max1 = mid1 + maxSpan / 2;
      span1 = maxSpan;
    }

    // Map world coords to SVG
    const toSvg = (v0: number, v1: number) => [
      PAD + ((v0 - min0) / span0) * (W - 2 * PAD),
      PAD + ((v1 - min1) / span1) * (H - 2 * PAD)
    ];

    // Color palette
    const palette = [
      "#4a90e2", "#27ae60", "#c9a7ff", "#e67e22", "#e74c3c", "#7ec7e6", "#b3c6e0", "#f7fafc"
    ];

    // SVG elements
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.classList.add("sceneaabb3index-svg");

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

    // Object AABBs
    aabbs.forEach(({ aabb }, i) => {
      const minA0 = aabb[ax0], maxA0 = aabb[ax0 + 3];
      const minA1 = aabb[ax1], maxA1 = aabb[ax1 + 3];
      const [ax, ay] = toSvg(minA0, minA1);
      const [bx, by] = toSvg(maxA0, maxA1);
      const objRect = document.createElementNS(svgNS, "rect");
      objRect.setAttribute("x", String(Math.min(ax, bx)));
      objRect.setAttribute("y", String(Math.min(ay, by)));
      objRect.setAttribute("width", String(Math.abs(bx - ax)));
      objRect.setAttribute("height", String(Math.abs(by - ay)));
      objRect.setAttribute("fill", palette[i % palette.length]);
      objRect.setAttribute("fill-opacity", "0.18");
      objRect.setAttribute("stroke", palette[i % palette.length]);
      objRect.setAttribute("stroke-width", "2");
      svg.appendChild(objRect);
    });

    // --- "You are here" pointer ---
    const [eye0, eye1] = [camEye[ax0], camEye[ax1]];
    const [look0, look1] = [camLook[ax0], camLook[ax1]];
    const [svgEyeX, svgEyeY] = toSvg(eye0, eye1);
    let dir0 = look0 - eye0, dir1 = look1 - eye1;
    let dirLen = Math.sqrt(dir0*dir0 + dir1*dir1) || 1;
    dir0 /= dirLen; dir1 /= dirLen;
    const arrowLen = 36 * 1.5;
    const arrowWidth = 18 * 1.5;
    const tipX = svgEyeX + dir0 * arrowLen;
    const tipY = svgEyeY + dir1 * arrowLen;
    const baseX = svgEyeX;
    const baseY = svgEyeY;
    const perp0 = -dir1, perp1 = dir0;
    const leftX = baseX + perp0 * (arrowWidth/2);
    const leftY = baseY + perp1 * (arrowWidth/2);
    const rightX = baseX - perp0 * (arrowWidth/2);
    const rightY = baseY - perp1 * (arrowWidth/2);
    const pointer = document.createElementNS(svgNS, "polygon");
    pointer.setAttribute("points",
      `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`
    );
    pointer.setAttribute("fill", "#e74c3c");
    pointer.setAttribute("stroke", "#b30000");
    pointer.setAttribute("stroke-width", "2");
    pointer.setAttribute("opacity", "0.95");
    pointer.setAttribute("filter", "drop-shadow(0 2px 6px #e74c3c44)");
    svg.appendChild(pointer);

    // --- Extents labels ---
    // Min label (lower left)
    const minLabel = document.createElementNS(svgNS, "text");
    minLabel.setAttribute("x", String(PAD + 6));
    minLabel.setAttribute("y", String(H - PAD - 8));
    minLabel.setAttribute("class", "sceneaabb3index-extentslabel");
    minLabel.textContent = `min: ${min0.toFixed(3)}, ${min1.toFixed(3)}`;
    svg.appendChild(minLabel);

    // Max label (upper right)
    const maxLabel = document.createElementNS(svgNS, "text");
    maxLabel.setAttribute("x", String(W - PAD - 6));
    maxLabel.setAttribute("y", String(PAD + 22));
    maxLabel.setAttribute("class", "sceneaabb3index-extentslabel");
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
.sceneaabb3index-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }
.sceneaabb3index-header {
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
.sceneaabb3index-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}
.sceneaabb3index-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}
.sceneaabb3index-h1 {  padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650;  }
.sceneaabb3index-subtitle { font-size: 12px; color: #444; line-height: 1.35; }
.sceneaabb3index-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px; /* reduced from 18px */
}
.sceneaabb3index-section {
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
  margin-bottom: 0; /* reduced from 12px */
  overflow: hidden;
}
.sceneaabb3index-section-summary {
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
.sceneaabb3index-section-summary:hover {
  background: #e6f0fa;
}
.sceneaabb3index-caret {
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
.sceneaabb3index-caret--open {
  transform: rotate(90deg);
  color: #4a90e2;
}
.sceneaabb3index-svgwrap { display: flex; flex-direction: column; align-items: center; padding: 18px; }
.sceneaabb3index-viewlabel {
  font-size: 14px;
  color: #444;
  margin-bottom: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-align: left;
}
.sceneaabb3index-extentspin {
  font-size: 13px;
  color: #2d5e8c;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: #f7fafc;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  padding: 6px 14px;
  margin-bottom: 16px;
  display: inline-block;
  box-shadow: 0 2px 8px rgba(74,144,226,0.06);
}
.sceneaabb3index-svg { border-radius: 10px; border: 1.5px solid #e6e6e6; background: #fff; }
`;
    document.head.appendChild(style);
  }
}

// Small DOM util
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, any> | null,
  children?: (HTMLElement | string | SVGElement)[]
): HTMLElement {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    if (k === "className") e.className = props[k];
    else if (k === "textContent") e.textContent = props[k];
    else if (k === "htmlFor") (e as any).htmlFor = props[k];
    else if (k.startsWith("on") && typeof props[k] === "function") e.addEventListener(<any>(k.slice(2)).toLowerCase(), props[k]);
    else e.setAttribute(k, props[k]);
  }
  if (children) for (const c of children) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return e;
}
