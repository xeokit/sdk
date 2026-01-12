import { ShaderView } from "./ShaderView";

type PrimitiveKey = keyof ShaderView["techniques"]; // "triangles" | "lines" | "points"
type PassMap = Record<string, { vertexSrc: string; fragmentSrc: string }>;

type Lang = "glsl" | "unknown";

export class ShaderDebugger {
  private readonly shaderView: ShaderView;
  private readonly container: HTMLElement;

  private rootEl!: HTMLElement;
  private primTabsEl!: HTMLElement;
  private passTabsEl!: HTMLElement;
  private contentEl!: HTMLElement;

  private activePrim: PrimitiveKey | null = null;
  private activePass: string | null = null;

  private readonly styleEl: HTMLStyleElement;

  constructor(shaderView: ShaderView, container: HTMLElement) {
    this.shaderView = shaderView;
    this.container = container;

    this.styleEl = document.createElement("style");
    this.styleEl.textContent = this.getCss();
    this.container.appendChild(this.styleEl);

    this.buildUI();
  }

  /** Remove UI + styles from container. */
  destroy() {
    this.rootEl?.remove();
    this.styleEl?.remove();
    this.activePrim = null;
    this.activePass = null;
  }

  /** Re-render from current ShaderView data (if shader sources changed). */
  refresh() {
    if (!this.rootEl) return;
    const prim = this.activePrim ?? (Object.keys(this.shaderView.techniques)[0] as PrimitiveKey);
    const pass = this.activePass ?? this.getPassKeys(prim)[0] ?? null;
    this.render(prim, pass);
  }

  // ---------------------------
  // UI building
  // ---------------------------

  private buildUI() {
    this.rootEl = document.createElement("div");
    this.rootEl.className = "sd-root";

    const header = document.createElement("div");
    header.className = "sd-header";

    const title = document.createElement("div");
    title.className = "sd-title";
    title.textContent = "Shader Debugger";

    const actions = document.createElement("div");
    actions.className = "sd-actions";

    const refreshBtn = this.makeButton("Refresh", () => this.refresh());
    actions.appendChild(refreshBtn);

    header.appendChild(title);
    header.appendChild(actions);

    this.primTabsEl = document.createElement("div");
    this.primTabsEl.className = "sd-tabs sd-tabs--primary";

    this.passTabsEl = document.createElement("div");
    this.passTabsEl.className = "sd-tabs sd-tabs--secondary";

    this.contentEl = document.createElement("div");
    this.contentEl.className = "sd-content";

    this.rootEl.appendChild(header);
    this.rootEl.appendChild(this.primTabsEl);
    this.rootEl.appendChild(this.passTabsEl);
    this.rootEl.appendChild(this.contentEl);

    this.container.appendChild(this.rootEl);

    const defaultPrim = (Object.keys(this.shaderView.techniques)[0] as PrimitiveKey) ?? "triangles";
    const defaultPass = this.getPassKeys(defaultPrim)[0] ?? null;
    this.render(defaultPrim, defaultPass);
  }

  private render(prim: PrimitiveKey, pass: string | null) {
    this.activePrim = prim;

    // Build primitive tabs
    this.primTabsEl.innerHTML = "";
    const primKeys = Object.keys(this.shaderView.techniques) as PrimitiveKey[];
    for (const k of primKeys) {
      const btn = this.makeTabButton(k, k === prim, () => {
        const firstPass = this.getPassKeys(k)[0] ?? null;
        this.render(k, firstPass);
      });
      this.primTabsEl.appendChild(btn);
    }

    // Build pass tabs for selected primitive
    this.passTabsEl.innerHTML = "";
    const passKeys = this.getPassKeys(prim);
    const safePass = pass && passKeys.includes(pass) ? pass : (passKeys[0] ?? null);
    this.activePass = safePass;

    for (const p of passKeys) {
      const btn = this.makeTabButton(p, p === safePass, () => this.render(prim, p));
      this.passTabsEl.appendChild(btn);
    }

    // Content
    this.contentEl.innerHTML = "";
    if (!safePass) {
      const empty = document.createElement("div");
      empty.className = "sd-empty";
      empty.textContent = `No render passes found for "${prim}".`;
      this.contentEl.appendChild(empty);
      return;
    }

    const passMap = this.getPassMap(prim);
    const shader = passMap[safePass];
    if (!shader) {
      const empty = document.createElement("div");
      empty.className = "sd-empty";
      empty.textContent = `No shader sources found for "${prim} / ${safePass}".`;
      this.contentEl.appendChild(empty);
      return;
    }

    const subtitle = document.createElement("div");
    subtitle.className = "sd-subtitle";
    subtitle.textContent = `${prim} / ${safePass}`;
    this.contentEl.appendChild(subtitle);

    const grid = document.createElement("div");
    grid.className = "sd-grid";

    grid.appendChild(this.makeCodePanel("Vertex Shader", shader.vertexSrc, "glsl"));
    grid.appendChild(this.makeCodePanel("Fragment Shader", shader.fragmentSrc, "glsl"));

    this.contentEl.appendChild(grid);
  }

  // ---------------------------
  // Helpers
  // ---------------------------

  private getPassMap(prim: PrimitiveKey): PassMap {
    // ShaderView's types differ per primitive; treat dynamically.
    return this.shaderView.techniques[prim] as unknown as PassMap;
  }

  private getPassKeys(prim: PrimitiveKey): string[] {
    const map = this.getPassMap(prim);
    return Object.keys(map).sort((a, b) => a.localeCompare(b));
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sd-btn";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private makeTabButton(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `sd-tab ${active ? "is-active" : ""}`.trim();
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private makeCodePanel(title: string, code: string, lang: Lang): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "sd-panel";

    const header = document.createElement("div");
    header.className = "sd-panel-header";

    const h = document.createElement("div");
    h.className = "sd-panel-title";
    h.textContent = title;

    const actions = document.createElement("div");
    actions.className = "sd-panel-actions";

    const copyBtn = this.makeButton("Copy", async () => {
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = "Copied";
        window.setTimeout(() => (copyBtn.textContent = "Copy"), 900);
      } catch {
        textarea.value = code;
        textarea.focus();
        textarea.select();
        document.execCommand?.("copy");
      }
    });

    actions.appendChild(copyBtn);

    header.appendChild(h);
    header.appendChild(actions);

    const pre = document.createElement("pre");
    pre.className = "sd-pre";

    const codeEl = document.createElement("code");
    codeEl.className = `sd-code lang-${lang}`;

    // 🔥 syntax highlighting: render tokens into spans
    codeEl.innerHTML = this.highlight(code, lang);

    pre.appendChild(codeEl);

    // Hidden textarea for copy fallback / manual selection
    const textarea = document.createElement("textarea");
    textarea.className = "sd-hidden-ta";
    textarea.setAttribute("aria-hidden", "true");
    textarea.tabIndex = -1;

    panel.appendChild(header);
    panel.appendChild(pre);
    panel.appendChild(textarea);

    return panel;
  }

  // ---------------------------
  // Syntax highlighting (simple GLSL lexer)
  // ---------------------------

  private highlight(src: string, lang: Lang): string {
    // Minimal + safe: escape first, then tokenise on escaped text with controlled span inserts.
    // We avoid regexes that can go exponential by keeping patterns simple.

    const escaped = this.escapeHtml(src);

    if (lang !== "glsl") {
      return escaped;
    }

    // Order matters: comments first, then strings, then numbers, then keywords/types/builtins.
    // We use "placeholders" to prevent later regex passes from touching already-highlighted segments.
    type Hold = { key: string; html: string };
    const holds: Hold[] = [];
    let s = escaped;

    const hold = (html: string) => {
      const key = `@@HL${holds.length}@@`;
      holds.push({ key, html });
      return key;
    };

    // Comments: //... and /* ... */
    s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => hold(`<span class="tok tok-comment">${m}</span>`));
    s = s.replace(/\/\/[^\n]*/g, (m) => hold(`<span class="tok tok-comment">${m}</span>`));

    // Strings: "..." or '...'
    s = s.replace(/"(?:\\.|[^"\\])*"/g, (m) => hold(`<span class="tok tok-string">${m}</span>`));
    s = s.replace(/'(?:\\.|[^'\\])*'/g, (m) => hold(`<span class="tok tok-string">${m}</span>`));

    // Preprocessor-ish lines (#define etc). GLSL often has these.
    s = s.replace(/^[ \t]*#[^\n]*/gm, (m) => hold(`<span class="tok tok-preproc">${m}</span>`));

    // Numbers: ints/floats/scientific
    s = s.replace(
      /\b(?:0x[0-9a-fA-F]+|\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?\b/g,
      (m) => `<span class="tok tok-number">${m}</span>`
    );

    // Keywords / qualifiers
    const keywords = [
      "if",
      "else",
      "for",
      "while",
      "do",
      "break",
      "continue",
      "return",
      "discard",
      "struct",
      "in",
      "out",
      "inout",
      "uniform",
      "const",
      "attribute",
      "varying",
      "layout",
      "precision",
      "highp",
      "mediump",
      "lowp",
      "invariant",
      "flat",
      "smooth",
      "noperspective",
      "centroid",
      "sampler",
      "sampler2D",
      "samplerCube",
      "sampler3D",
      "sampler2DShadow",
      "samplerCubeShadow",
      "sampler2DArray",
      "sampler2DArrayShadow",
      "isampler2D",
      "usampler2D",
      "isamplerCube",
      "usamplerCube",
      "void",
    ];

    // Types
    const types = [
      "bool",
      "int",
      "uint",
      "float",
      "double",
      "vec2",
      "vec3",
      "vec4",
      "bvec2",
      "bvec3",
      "bvec4",
      "ivec2",
      "ivec3",
      "ivec4",
      "uvec2",
      "uvec3",
      "uvec4",
      "mat2",
      "mat3",
      "mat4",
      "mat2x2",
      "mat2x3",
      "mat2x4",
      "mat3x2",
      "mat3x3",
      "mat3x4",
      "mat4x2",
      "mat4x3",
      "mat4x4",
    ];

    // Builtins (common)
    const builtins = [
      "radians",
      "degrees",
      "sin",
      "cos",
      "tan",
      "asin",
      "acos",
      "atan",
      "pow",
      "exp",
      "log",
      "exp2",
      "log2",
      "sqrt",
      "inversesqrt",
      "abs",
      "sign",
      "floor",
      "ceil",
      "fract",
      "mod",
      "min",
      "max",
      "clamp",
      "mix",
      "step",
      "smoothstep",
      "length",
      "distance",
      "dot",
      "cross",
      "normalize",
      "faceforward",
      "reflect",
      "refract",
      "matrixCompMult",
      "lessThan",
      "lessThanEqual",
      "greaterThan",
      "greaterThanEqual",
      "equal",
      "notEqual",
      "any",
      "all",
      "not",
      "texture",
      "texture2D",
      "textureCube",
    ];

    // Special variables / gl_*
    s = s.replace(/\bgl_[A-Za-z_0-9]+\b/g, (m) => `<span class="tok tok-gl">${m}</span>`);

    const wordRE = (words: string[]) =>
      new RegExp(`\\b(?:${words.map((w) => this.escapeRegExp(w)).join("|")})\\b`, "g");

    s = s.replace(wordRE(types), (m) => `<span class="tok tok-type">${m}</span>`);
    s = s.replace(wordRE(keywords), (m) => `<span class="tok tok-kw">${m}</span>`);
    s = s.replace(wordRE(builtins), (m) => `<span class="tok tok-fn">${m}</span>`);

    // Restore held segments last
    for (const h of holds) {
      s = s.replaceAll(h.key, h.html);
    }

    return s;
  }

  private escapeHtml(s: string): string {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private getCss(): string {
    // Scoped by .sd-root
    return `
.sd-root{
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji","Segoe UI Emoji";
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.sd-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0,0,0,.08);
  background: rgba(0,0,0,.02);
}
.sd-title{ font-weight: 700; }
.sd-actions{ display:flex; gap:8px; }

.sd-tabs{
  display:flex;
  gap:6px;
  padding: 10px 12px;
  overflow:auto;
  border-bottom: 1px solid rgba(0,0,0,.08);
}
.sd-tabs--secondary{
  background: rgba(0,0,0,.01);
}

.sd-tab{
  appearance:none;
  border: 1px solid rgba(0,0,0,.14);
  background:#fff;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor:pointer;
  user-select:none;
  white-space: nowrap;
}
.sd-tab.is-active{
  border-color: rgba(0,0,0,.35);
  background: rgba(0,0,0,.06);
  font-weight: 600;
}

.sd-btn{
  appearance:none;
  border: 1px solid rgba(0,0,0,.14);
  background:#fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor:pointer;
}
.sd-btn:hover{ background: rgba(0,0,0,.04); }

.sd-content{
  padding: 12px;
}
.sd-subtitle{
  font-size: 12px;
  opacity: .7;
  margin-bottom: 10px;
}
.sd-grid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 900px){
  .sd-grid{ grid-template-columns: 1fr; }
}
.sd-panel{
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  min-width: 0;
}
.sd-panel-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding: 10px 10px;
  border-bottom: 1px solid rgba(0,0,0,.08);
  background: rgba(0,0,0,.02);
}
.sd-panel-title{ font-weight: 700; font-size: 12px; }
.sd-panel-actions{ display:flex; gap:8px; }

.sd-pre{
  margin:0;
  padding: 10px;
  overflow:auto;
  max-height: 80vh;
  background: #0b0f19;
  color: #e6edf3;
  font-size: 12px;
  line-height: 1.45;
}
.sd-code{
  white-space: pre;
  tab-size: 2;
}

/* --- Syntax highlighting tokens --- */
.sd-code .tok{ }
.sd-code .tok-comment{ color: rgba(230,237,243,.55); font-style: italic; }
.sd-code .tok-string{ color: #a5d6ff; }
.sd-code .tok-number{ color: #ffd29d; }
.sd-code .tok-preproc{ color: #c3b1ff; }
.sd-code .tok-kw{ color: #ff7fd0; font-weight: 600; }
.sd-code .tok-type{ color: #7ee787; font-weight: 600; }
.sd-code .tok-fn{ color: #79c0ff; }
.sd-code .tok-gl{ color: #f0883e; font-weight: 600; }

.sd-empty{
  padding: 16px;
  opacity: .7;
}
.sd-hidden-ta{
  position:absolute;
  left:-9999px;
  top:-9999px;
  width:1px;
  height:1px;
  opacity:0;
}
`;
  }
}
