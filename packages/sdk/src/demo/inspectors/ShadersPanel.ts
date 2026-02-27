import {FloatingPanelFlowHost} from "./FloatingPanelFlowHost";
import {ShaderInspector, type ShaderSource} from "../../webglrenderer/internal/inspectors";

// In file: packages/sdk/src/demo/ShadersPanel.ts

function shaderIconDataUri(): string {
  // 60x60 SVG: simple flat-shaded 3D cube
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <!-- Shadow -->
  <ellipse cx="30" cy="48" rx="16" ry="5" fill="#222" opacity="0.13"/>
  <!-- Cube faces -->
  <polygon points="30,14 48,24 48,42 30,52 12,42 12,24" fill="#4a90e2" stroke="#2d5e8c" stroke-width="2"/>
  <polygon points="30,14 48,24 30,34 12,24" fill="#7ec7e6" stroke="#2d5e8c" stroke-width="2"/>
  <polygon points="48,24 48,42 30,52 30,34" fill="#c9a7ff" stroke="#2d5e8c" stroke-width="2"/>
  <polygon points="12,24 12,42 30,52 30,34" fill="#27ae60" stroke="#2d5e8c" stroke-width="2"/>
  <!-- Border -->
  <rect x="4" y="4" width="52" height="52" rx="12" fill="none" stroke="#e6e6e6" stroke-width="1.5"/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function fileIconSvg() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "shins-fileicon");
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
 * Floating, dependency-free HTML view for ShaderInspector#techniques, with GLSL highlighting.
 * Highlighting is lightweight (regex/token-based), no dependencies.
 *
 * Usage:
 *   ShadersPanel.show(inspector);
 *   ShadersPanel.hide();
 *   ShadersPanel.toggle(inspector);
 */
export class ShadersPanel {
  static #TILE_ID = "__shaderinsp_tile__";
  static #STYLE_ID = "__shaderinsp_style__";
  static #STATE_KEY = "__shaderinsp_collapsed__";
  static #TREE_KEY = "__shaderinsp_tree__";

  static show(flowHost: HTMLDivElement, inspector: ShaderInspector, opts: any = {}) {
    this.#ensureGlobalStyle();

    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;
    const root = this.render(inspector, opts);

    if (!tile) {
      tile = FloatingPanelFlowHost.mountTile(root, {
        tileMinWidth: opts.tileMinWidth ?? opts.maxWidth ?? 460,
        tileMaxWidth: opts.tileMaxWidth ?? opts.maxWidth ?? 540
      }) as HTMLDivElement;
      tile.id = this.#TILE_ID;
      flowHost.appendChild(tile);
    } else {
      tile.replaceChildren(root);
    }

    return tile;
  }

  // static hide() {
  //   const tile = document.getElementById(this.#TILE_ID);
  //   if (tile) tile.remove();
  // }
  //
  // static toggle(inspector: ShaderInspector, opts?: any) {
  //   const tile = document.getElementById(this.#TILE_ID);
  //   if (tile) this.hide();
  //   else this.show(inspector, opts);
  // }

  static render(inspector: ShaderInspector, opts: any = {}) {
    const root = el("div", {className: "shins-root"});

    const collapsed = readBool(this.#STATE_KEY, !!opts.startCollapsed);

    const header = this.renderHeader({collapsed}, opts);
    const body = this.renderBody(inspector, opts);

    root.appendChild(header);
    root.appendChild(body);

    this.#setCollapsed(root, collapsed);

    header
      .querySelector<HTMLButtonElement>("[data-shins-toggle]")
      ?.addEventListener("click", () => {
        const nowCollapsed = !root.classList.contains("shins-collapsed");
        this.#setCollapsed(root, nowCollapsed);
        writeBool(this.#STATE_KEY, nowCollapsed);
      });

    header
      .querySelector<HTMLButtonElement>("[data-shins-expandall]")
      ?.addEventListener("click", () => this.#setAllTreeOpen(root, true));

    header
      .querySelector<HTMLButtonElement>("[data-shins-collapseall]")
      ?.addEventListener("click", () => this.#setAllTreeOpen(root, false));

    header
      .querySelector<HTMLInputElement>("[data-shins-filter]")
      ?.addEventListener("input", (e) => {
        const q = String((e.target as HTMLInputElement).value || "");
        this.#applyFilter(root, q);
      });

    return root;
  }

  // ---------------------------------------------------------------------------
  // Header / body
  // ---------------------------------------------------------------------------

  static renderHeader({collapsed}: { collapsed: boolean }, opts: any = {}) {
    const header = el("div", {className: "shins-header"});

    const title = opts.title ?? "Shaders";
    const subtitle = opts.subtitle ?? "Inspect WebGL shader sources (GLSL).";

    // Icon (shader)
    const icon = el("img", {
      className: "shins-title-icon",
      width: 60,
      height: 60,
      alt: "Shader icon",
      src: shaderIconDataUri(),
      draggable: false,
    });

    // Title and subtitle stacked vertically, left-justified
    const textCol = el("div", {className: "shins-title-col"}, [
      el("div", {className: "shins-h1", textContent: title}),
      el("div", {className: "shins-subtitle", textContent: subtitle}),
    ]);

    // Flex row: icon | textCol
    header.appendChild(icon);
    header.appendChild(textCol);

    return header;
  }

  // In ShadersPanel class:

  static renderBody(inspector: ShaderInspector, _opts: any = {}) {
    const body = el("div", {className: "shins-body"});
    const treeState = readJson(this.#TREE_KEY, {} as Record<string, boolean>);
    const techniques = (inspector as any)?.techniques || {};
    const tree = this.#renderTechniquesTree(techniques, treeState);
    body.appendChild(tree);
    return body;
  }

// --- In ShadersPanel class ---

  static #renderTechniquesTree(techniques: any, state: Record<string, boolean>) {
    const root = el("div", {className: "shins-tree", ["data-shins-tree-root" as any]: ""});
    const titles = {
      triangles: "Triangles",
      lines: "Lines",
      points: "Points"
    };
    for (const groupName of Object.keys(techniques)) {
      const groupObj = techniques[groupName];
      const groupPath = `techniques.${groupName}`;
      // Ensure group is collapsed by default
      if (!(groupPath in state)) state[groupPath] = false;
      root.appendChild(
        this.#treeGroup(
          titles[groupName] || groupName,
          groupPath,
          state,
          () => {
            const groupWrap = el("div", {className: "shins-tree-techniques"});
            for (const techName of Object.keys(groupObj || {})) {
              const tech = groupObj[techName];
              const techPath = `${groupPath}.${techName}`;
              // Ensure technique is collapsed by default
              if (!(techPath in state)) state[techPath] = false;
              groupWrap.appendChild(
                this.#treeTechnique(
                  techName,
                  techPath,
                  state,
                  () => {
                    const leafs = [];
                    if (tech.vertexShaderSrc) {
                      leafs.push(this.#shaderLeaf("vertex", techName, tech));
                    }
                    if (tech.fragmentShaderSrc) {
                      leafs.push(this.#shaderLeaf("fragment", techName, tech));
                    }
                    return el("div", {className: "shins-technique-leafs"}, leafs);
                  }
                )
              );
            }
            return groupWrap;
          }
        )
      );
    }
    return root;
  }

  static #treeGroup(label: string, path: string, state: Record<string, boolean>, renderChildren: () => HTMLElement) {
    const expanded = !!state[path];
    const node = el("div", {className: "shins-tree-group"});
    const caret = el("span", {
      className: "shins-caret" + (expanded ? " shins-caret--open" : ""),
      textContent: "▸",
      "aria-hidden": "true"
    });
    const summary = el("div", {className: "shins-summary shins-tree-title"}, [
      caret,
      el("span", {textContent: label})
    ]);
    const content = el("div", {className: "shins-node-content", style: expanded ? "" : "display:none;"});
    if (expanded) content.appendChild(renderChildren());

    summary.addEventListener("click", (e) => {
      e.preventDefault();
      if (content.style.display === "none") {
        content.style.display = "";
        caret.classList.add("shins-caret--open");
        if (!content.hasChildNodes()) content.appendChild(renderChildren());
        state[path] = true;
      } else {
        content.style.display = "none";
        caret.classList.remove("shins-caret--open");
        state[path] = false;
      }
      writeJson(ShadersPanel.#TREE_KEY, state);
    });

    node.appendChild(summary);
    node.appendChild(content);
    return node;
  }

  static #treeTechnique(label: string, path: string, state: Record<string, boolean>, renderChildren: () => HTMLElement) {
    const expanded = !!state[path];
    const node = el("div", {className: "shins-tree-technique"});
    const caret = el("span", {
      className: "shins-caret" + (expanded ? " shins-caret--open" : ""),
      textContent: "▸",
      "aria-hidden": "true"
    });
    const summary = el("div", {className: "shins-summary shins-tree-technique-title"}, [
      caret,
      el("span", {textContent: label})
    ]);
    const content = el("div", {className: "shins-node-content", style: expanded ? "" : "display:none;"});
    if (expanded) content.appendChild(renderChildren());

    summary.addEventListener("click", (e) => {
      e.preventDefault();
      if (content.style.display === "none") {
        content.style.display = "";
        caret.classList.add("shins-caret--open");
        if (!content.hasChildNodes()) content.appendChild(renderChildren());
        state[path] = true;
      } else {
        content.style.display = "none";
        caret.classList.remove("shins-caret--open");
        state[path] = false;
      }
      writeJson(ShadersPanel.#TREE_KEY, state);
    });

    node.appendChild(summary);
    node.appendChild(content);
    return node;
  }


  static #shaderLeaf(kind: "vertex" | "fragment", path: string, technique: ShaderSource) {
    const wrap = el("div", {className: "shins-leaf", ["data-shins-leaf" as any]: ""});
    const head = el("div", {className: "shins-leaf-head"}, [
      el("div", {className: "shins-leaf-title"}, [
        el("span", {textContent: kind === "vertex" ? "Vertex shader" : "Fragment shader"}),
        el("div", {className: "shins-leaf-actions"}, [
          el("button", {
            className: "shins-btn shins-btn--sub",
            textContent: "GLSL",
            onclick: () => {
              ShadersPanel.openShaderSourceInTab(kind, path,
                kind === "vertex" ? technique.vertexShaderSrc : technique.fragmentShaderSrc);
            },
          }),
          el("button", {
            className: "shins-btn shins-btn--sub",
            textContent: "GLSL + Comments",
            onclick: () => {
              ShadersPanel.openShaderSourceInTab(kind, path,
                kind === "vertex" ? technique.vertexShaderCommentedSrc : technique.fragmentShaderCommentedSrc);
            },
          })
        ])
      ])
    ]);
    wrap.appendChild(head);
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Panel state helpers
  // ---------------------------------------------------------------------------

  static #setCollapsed(root: HTMLElement, collapsed: boolean) {
    root.classList.toggle("shins-collapsed", collapsed);

    const body = root.querySelector<HTMLElement>(".shins-body");
    if (body) body.style.display = collapsed ? "none" : "block";

    const caret = root.querySelector<HTMLElement>("[data-shins-caret]");
    if (caret) caret.textContent = collapsed ? "▸" : "▾";

    const state = root.querySelector<HTMLElement>("[data-shins-state]");
    if (state) state.textContent = collapsed ? "Collapsed" : "Expanded";
  }

  static #setAllTreeOpen(root: HTMLElement, open: boolean) {
    const state = readJson(this.#TREE_KEY, {} as Record<string, boolean>);
    const nodes = root.querySelectorAll<HTMLDetailsElement>(".shins-details[data-shins-path]");
    nodes.forEach((d) => {
      const path = d.getAttribute("data-shins-path") || "";
      d.open = open;
      if (path) state[path] = open;
    });
    writeJson(this.#TREE_KEY, state);
  }

  static #applyFilter(root: HTMLElement, query: string) {
    const q = query.trim().toLowerCase();

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-shins-node], [data-shins-leaf]"));
    if (!q) {
      nodes.forEach((n) => (n.style.display = ""));
      return;
    }

    nodes.forEach((n) => (n.style.display = "none"));

    const matchNodes: HTMLElement[] = [];
    const allDetails = Array.from(root.querySelectorAll<HTMLDetailsElement>("[data-shins-node]"));

    for (const d of allDetails) {
      const summary = d.querySelector<HTMLElement>(".shins-summary");
      const text = (summary?.textContent || "").toLowerCase();
      if (text.includes(q)) matchNodes.push(d);
    }

    // Scan plain (not highlighted) source from dataset
    const pres = Array.from(root.querySelectorAll<HTMLElement>("[data-shins-src]"));
    for (const pre of pres) {
      const plain = ((pre as any).dataset?.shinsPlain ?? "") as string;
      const path = (pre.getAttribute("data-shins-src") || "").toLowerCase();
      if (path.includes(q) || plain.toLowerCase().includes(q)) {
        const leaf = pre.closest<HTMLElement>("[data-shins-leaf]");
        if (leaf) matchNodes.push(leaf);
        const details = pre.closest<HTMLDetailsElement>("[data-shins-node]");
        if (details) matchNodes.push(details);
      }
    }

    for (const n of matchNodes) {
      let cur: HTMLElement | null = n;
      while (cur) {
        if (cur.matches("[data-shins-node], [data-shins-leaf], [data-shins-tree-root]")) cur.style.display = "";
        cur = cur.parentElement;
      }
      n.style.display = "";
    }
  }

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = DEFAULT_CSS;
    document.head.appendChild(s);
  }

  static openShaderSourceInTab(kind: "vertex" | "fragment", name: string, src: string) {
    const highlighted = highlightGLSL(src);
    const title = `${name} (${kind} shader)`;
    const css = `
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .glsl-kw { color: #7ec7e6; font-weight: 600; }
    .glsl-builtin { color: #ffd57a; }
    .glsl-num { color: #b3e6c7; }
    .glsl-comment { color: #888; font-style: italic; }
    .glsl-str { color: #ffe7b3; }
    .glsl-pp { color: #ffd57a; font-weight: 600; }
    pre { margin: 0; padding: 24px; font-size: 15px; line-height: 1.6; background: #0f1116; border: none; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 0 0 12px 0; }
    .meta { color: #aaa; font-size: 13px; margin-bottom: 18px; }
  `;
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <meta charset="utf-8">
      <style>${css}</style>
    </head>
    <body>
      <h1>${escapeHtml(name)}</h1>
      <div class="meta">${escapeHtml(kind)} shader</div>
      <pre><code>${highlighted}</code></pre>
    </body>
    </html>
  `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      alert("Unable to open new tab. Please allow popups for this site.");
    }
  }
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------


function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: any = {},
  children: Array<Node> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) (node as any)[key] = value;
  for (const child of children) node.appendChild(child);
  return node;
}

function countLines(src: string) {
  return Math.max(1, src.split(/\r\n|\r|\n/).length);
}

async function tryCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
    }
    ta.remove();
  }
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
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: any) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

// minimal escape for attribute selectors
function cssEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Tiny, dependency-free GLSL highlighter.
 * Order matters: we protect strings/comments first, then tokenize remaining text.
 */
function highlightGLSL(src: string) {
  type Tok = { t: "raw" | "comment" | "string"; v: string };
  const parts: Tok[] = [];

  // 1) Split into raw/comment/string tokens (single pass scan)
  const s = src;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];

    // line comment //
    if (ch === "/" && next === "/") {
      const start = i;
      i += 2;
      while (i < s.length && s[i] !== "\n") i++;
      parts.push({t: "comment", v: s.slice(start, i)});
      continue;
    }

    // block comment /* */
    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i = Math.min(s.length, i + 2);
      parts.push({t: "comment", v: s.slice(start, i)});
      continue;
    }

    // string "..."
    if (ch === '"') {
      const start = i;
      i++;
      while (i < s.length) {
        if (s[i] === "\\" && i + 1 < s.length) {
          i += 2;
          continue;
        }
        if (s[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      parts.push({t: "string", v: s.slice(start, i)});
      continue;
    }

    // raw chunk
    const start = i;
    i++;
    while (i < s.length) {
      const c = s[i];
      const n = s[i + 1];
      if ((c === "/" && (n === "/" || n === "*")) || c === '"') break;
      i++;
    }
    parts.push({t: "raw", v: s.slice(start, i)});
  }

  // 2) Highlight raw chunks with regex replacements (on escaped HTML)
  const kw = [
    // storage / qualifiers / control
    "attribute", "uniform", "varying", "const", "in", "out", "inout", "precision",
    "highp", "mediump", "lowp", "layout", "centroid", "flat", "smooth", "noperspective",
    "if", "else", "for", "while", "do", "break", "continue", "return", "discard",
    "struct", "void",
    // types
    "bool", "int", "uint", "float", "double",
    "vec2", "vec3", "vec4", "bvec2", "bvec3", "bvec4", "ivec2", "ivec3", "ivec4", "uvec2", "uvec3", "uvec4",
    "mat2", "mat3", "mat4", "mat2x2", "mat2x3", "mat2x4", "mat3x2", "mat3x3", "mat3x4", "mat4x2", "mat4x3", "mat4x4",
    "sampler2D", "samplerCube", "sampler2DShadow", "samplerCubeShadow", "sampler3D", "sampler2DArray",
  ];
  const kwRe = new RegExp(`\\b(${kw.join("|")})\\b`, "g");

  const builtins = [
    "gl_Position", "gl_FragColor", "gl_FragCoord", "gl_PointSize", "gl_PointCoord",
    "gl_FrontFacing", "gl_FragDepth",
  ];
  const builtinRe = new RegExp(`\\b(${builtins.join("|")})\\b`, "g");

  // numbers: 1, 1.0, .5, 1e-3, 0xFF (rare in glsl but ok)
  const numRe = /\b(?:0x[0-9a-fA-F]+|\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?\b/g;

  // preprocessor line starts (after escaping)
  // we'll wrap whole directive line
  function highlightRaw(raw: string) {
    const escaped = escapeHtml(raw);

    // preprocessor directives (line-level)
    const withPP = escaped.replace(
      /(^|\n)(\s*#.*?)(?=\n|$)/g,
      (_m, p1, p2) => `${p1}<span class="glsl-pp">${p2}</span>`
    );

    // then keywords/builtins/numbers (avoid inside existing spans: keep it simple; ok for GLSL)
    return withPP
      .replace(builtinRe, `<span class="glsl-builtin">$1</span>`)
      .replace(kwRe, `<span class="glsl-kw">$1</span>`)
      .replace(numRe, `<span class="glsl-num">$&</span>`);
  }

  // 3) Stitch back together
  let out = "";
  for (const p of parts) {
    if (p.t === "comment") out += `<span class="glsl-comment">${escapeHtml(p.v)}</span>`;
    else if (p.t === "string") out += `<span class="glsl-str">${escapeHtml(p.v)}</span>`;
    else out += highlightRaw(p.v);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Default CSS
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.shins-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px;
  background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14);
  backdrop-filter: blur(2px);
}

.shins-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
}
.shins-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}
.shins-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}
.shins-title { display: grid; gap: 4px; }
.shins-h1 { padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650; }
.shins-subtitle { font-size: 12px; color: #444; line-height: 1.35; }

.shins-filter { width: 100%; border-radius: 10px; border: 1px solid #e6e6e6; padding: 8px 10px; font-size: 12px; }
.shins-filter:focus { outline: none; border-color: #cfe5ff; box-shadow: 0 0 0 3px rgba(207,229,255,0.7); }

.shins-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.shins-caret { font-size: 14px; color: #444; width: 18px; text-align: center; }

.shins-btn {
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
.shins-btn:hover {
  background: #e6f0fa;
  border-color: #b3c6e0;
}
.shins-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.shins-btn--sub { }

.shins-status { display: flex; gap: 8px; align-items: baseline; }
.shins-status-label { font-size: 12px; color: #666; }
.shins-status-value { font-size: 12px; font-weight: 600; }

.shins-body { margin-top: 12px; }

/* --- Techniques tree --- */
.shins-tree {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 4px;
}

.shins-tree-group {
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(74,144,226,0.04);
  margin-bottom: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.shins-tree-title {
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
}
.shins-tree-title:hover {
  background: #e6f0fa;
}

.shins-tree-techniques {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
}

.shins-tree-technique {
  border-top: 1px solid #f0f0f0;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.shins-tree-technique-title {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #666;
  background: none;
  padding: 10px 22px 8px 32px;
  user-select: none;
  transition: background 0.13s;
}
.shins-tree-technique-title:hover {
  background: #f7fafc;
}

.shins-caret {
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
.shins-caret--open {
  transform: rotate(90deg);
  color: #4a90e2;
}

.shins-summary {
  /* base for all summary rows */
  user-select: none;
  outline: none;
}

.shins-node-content {
  padding: 0 0 0 0;
  border-top: none;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.shins-technique-leafs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 32px 14px 48px;
  background: #f7fafc;
}

.shins-leaf {
  border: 1px solid #e6e6e6;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  margin-bottom: 0;
}
.shins-leaf-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  gap: 8px;
}
.shins-leaf-title {
  font-size: 12px;
  font-weight: 650;
  flex: 1;
  min-width: 0;
}
.shins-leaf-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.shins-leaf-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.shins-pill { font-size: 11px; border-radius: 999px; padding: 3px 8px; border: 1px solid #e6e6e6; background: #fafafa; color: #333; }
.shins-pill--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #444; background: #fff; }

.shins-pre { margin: 0; padding: 10px 12px; background: #0f1116; color: #e7e7e7; overflow: auto;
  font-size: 11px; line-height: 1.35; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  max-height: 220px;
}
.shins-code { white-space: pre; }
.shins-pre--expanded { max-height: 70vh; }

.shins-collapsed .shins-body { display: none; }

/* --- GLSL token colors (no external deps) --- */
.glsl-comment { color: #8b949e; font-style: italic; }
.glsl-str { color: #a5d6ff; }
.glsl-kw { color: #c9a7ff; font-weight: 600; }
.glsl-builtin { color: #7ee787; font-weight: 600; }
.glsl-num { color: #ffab70; }
.glsl-pp { color: #ffd57a; font-weight: 600; }
`;
