/**
 * SceneGraphOverlay
 *
 * Creates an absolutely-positioned floating overlay that renders a node graph
 * of a xeokit Scene's Model/Object/Mesh/Geometry relationships.
 *
 * Rendering tech: HTML5 Canvas (force-directed layout + zoom/pan + dragging)
 *
 * Usage:
 *   const graph = new SceneGraphOverlay(scene, { right: 16, top: 16, width: 520, height: 360 });
 *   graph.start();
 *   // ...later:
 *   graph.refresh();   // rebuild graph from Scene
 *   graph.destroy();
 */
export class SceneGraphOverlay {
  /**
   * @param {object} scene xeokit Scene instance
   * @param {object} [opts]
   */
  constructor(scene, opts = {}) {
    this.scene = scene;

    this.opts = {
      // overlay placement
      left: opts.left ?? null,
      right: opts.right ?? 16,
      top: opts.top ?? 16,
      bottom: opts.bottom ?? null,
      width: opts.width ?? 520,
      height: opts.height ?? 360,
      zIndex: opts.zIndex ?? 999999,

      // look & feel
      title: opts.title ?? "Scene Graph",
      background: opts.background ?? "rgba(14, 18, 24, 0.86)",
      border: opts.border ?? "1px solid rgba(255,255,255,0.10)",
      textColor: opts.textColor ?? "rgba(255,255,255,0.92)",
      subtleTextColor: opts.subtleTextColor ?? "rgba(255,255,255,0.65)",

      // graph tuning
      nodeRadius: opts.nodeRadius ?? 16,
      linkDistance: opts.linkDistance ?? 95,
      repulsion: opts.repulsion ?? 1400,
      centerPull: opts.centerPull ?? 0.06,
      damping: opts.damping ?? 0.90,
      iterationsPerFrame: opts.iterationsPerFrame ?? 2,

      // optional: supply your own scene accessors if your Scene shape differs
      accessors: {
        getModels: opts.accessors?.getModels ?? defaultGetModels,
        getObjects: opts.accessors?.getObjects ?? defaultGetObjects,
        getMeshes: opts.accessors?.getMeshes ?? defaultGetMeshes,
        getGeometries: opts.accessors?.getGeometries ?? defaultGetGeometries,
        // if you already have a graph, you can override this instead:
        buildGraph: opts.accessors?.buildGraph ?? null,
      },

      // whether to auto-refresh periodically (ms). set to 0/false to disable.
      autoRefreshMs: opts.autoRefreshMs ?? 0,
    };

    // internal state
    this._running = false;
    this._raf = 0;
    this._refreshTimer = 0;

    this._nodes = [];
    this._links = [];
    this._nodeById = new Map();

    // interaction
    this._dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this._zoom = 1;
    this._pan = { x: 0, y: 0 };
    this._drag = { active: false, node: null, offsetX: 0, offsetY: 0 };
    this._panning = { active: false, startX: 0, startY: 0, panX: 0, panY: 0 };

    // create UI
    this._createOverlay();
    this.refresh(); // initial build/render
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._tick();

    if (this.opts.autoRefreshMs && this.opts.autoRefreshMs > 0) {
      this._refreshTimer = window.setInterval(() => this.refresh(), this.opts.autoRefreshMs);
    }
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._refreshTimer = 0;
  }

  refresh() {
    const { buildGraph } = this.opts.accessors;

    let graph;
    if (typeof buildGraph === "function") {
      graph = buildGraph(this.scene);
    } else {
      graph = buildGraphFromScene(this.scene, this.opts.accessors);
    }

    const { nodes, links } = graph;

    // preserve positions for stable layout when refreshing
    const prev = new Map(this._nodes.map((n) => [n.id, n]));

    this._nodes = nodes.map((n) => {
      const p = prev.get(n.id);
      return {
        ...n,
        x: p?.x ?? (Math.random() - 0.5) * 220,
        y: p?.y ?? (Math.random() - 0.5) * 160,
        vx: p?.vx ?? 0,
        vy: p?.vy ?? 0,
        fx: p?.fx ?? null,
        fy: p?.fy ?? null,
      };
    });

    this._links = links.map((l) => ({ ...l }));
    this._nodeById = new Map(this._nodes.map((n) => [n.id, n]));

    // Set initial pan to center the graph a bit
    this._pan.x = this._pan.x || this._canvas.width / (2 * this._dpr);
    this._pan.y = this._pan.y || (this._headerHeight + (this._canvas.height / this._dpr - this._headerHeight) / 2);

    this._render(); // immediate redraw
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this._onResize);
    this._detachInput();
    this._root.remove();
  }

  // -------------------------
  // UI creation & input
  // -------------------------

  _createOverlay() {
    const root = document.createElement("div");
    root.style.position = "absolute";
    root.style.zIndex = String(this.opts.zIndex);
    root.style.width = `${this.opts.width}px`;
    root.style.height = `${this.opts.height}px`;
    root.style.background = this.opts.background;
    root.style.border = this.opts.border;
    root.style.borderRadius = "14px";
    root.style.boxShadow = "0 18px 60px rgba(0,0,0,0.45)";
    root.style.backdropFilter = "blur(6px)";
    root.style.overflow = "hidden";
    root.style.userSelect = "none";

    if (this.opts.left != null) root.style.left = `${this.opts.left}px`;
    if (this.opts.right != null) root.style.right = `${this.opts.right}px`;
    if (this.opts.top != null) root.style.top = `${this.opts.top}px`;
    if (this.opts.bottom != null) root.style.bottom = `${this.opts.bottom}px`;

    // header
    const header = document.createElement("div");
    header.style.height = "44px";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "0 10px 0 12px";
    header.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
    header.style.cursor = "grab";

    const title = document.createElement("div");
    title.textContent = this.opts.title;
    title.style.font = '600 13px/1.1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial';
    title.style.color = this.opts.textColor;
    title.style.letterSpacing = "0.2px";

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.alignItems = "center";

    const pill = (txt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = txt;
      b.style.font = '600 12px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial';
      b.style.color = this.opts.textColor;
      b.style.background = "rgba(255,255,255,0.08)";
      b.style.border = "1px solid rgba(255,255,255,0.12)";
      b.style.borderRadius = "999px";
      b.style.padding = "6px 10px";
      b.style.cursor = "pointer";
      b.style.outline = "none";
      b.onmouseenter = () => (b.style.background = "rgba(255,255,255,0.12)");
      b.onmouseleave = () => (b.style.background = "rgba(255,255,255,0.08)");
      return b;
    };

    const btnRefresh = pill("Refresh");
    btnRefresh.onclick = () => this.refresh();

    const btnReset = pill("Reset View");
    btnReset.onclick = () => {
      this._zoom = 1;
      this._pan.x = this._canvas.width / (2 * this._dpr);
      this._pan.y = this._headerHeight + (this._canvas.height / this._dpr - this._headerHeight) / 2;
      this._render();
    };

    controls.appendChild(btnRefresh);
    controls.appendChild(btnReset);

    header.appendChild(title);
    header.appendChild(controls);

    // canvas
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = `calc(100% - 44px)`;
    canvas.style.display = "block";
    canvas.style.cursor = "default";

    root.appendChild(header);
    root.appendChild(canvas);

    document.body.appendChild(root);

    this._root = root;
    this._header = header;
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");

    this._headerHeight = 44;

    // make overlay draggable via header
    this._enableWindowDrag();

    // resize handling
    this._onResize = () => this._resizeCanvas();
    window.addEventListener("resize", this._onResize);
    this._resizeCanvas();

    // input
    this._attachInput();
  }

  _resizeCanvas() {
    const rect = this._canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * this._dpr));
    const h = Math.max(1, Math.floor(rect.height * this._dpr));
    if (this._canvas.width !== w || this._canvas.height !== h) {
      this._canvas.width = w;
      this._canvas.height = h;
      this._render();
    }
  }

  _enableWindowDrag() {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    // convert right/bottom anchored overlays into left/top on first drag
    const ensureLeftTop = () => {
      const rect = this._root.getBoundingClientRect();
      this._root.style.left = `${rect.left}px`;
      this._root.style.top = `${rect.top}px`;
      this._root.style.right = "auto";
      this._root.style.bottom = "auto";
    };

    this._header.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      ensureLeftTop();
      dragging = true;
      this._header.style.cursor = "grabbing";
      startX = e.clientX;
      startY = e.clientY;
      const rect = this._root.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this._root.style.left = `${startLeft + dx}px`;
      this._root.style.top = `${startTop + dy}px`;
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
      this._header.style.cursor = "grab";
    });
  }

  _attachInput() {
    const c = this._canvas;

    this._onWheel = (e) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY);
      const factor = delta > 0 ? 0.9 : 1.1;

      // zoom around cursor
      const pt = this._screenToWorld(e.offsetX, e.offsetY);
      const prevZoom = this._zoom;
      this._zoom = clamp(this._zoom * factor, 0.35, 2.4);

      const nx = pt.x * this._zoom - pt.x * prevZoom;
      const ny = pt.y * this._zoom - pt.y * prevZoom;
      this._pan.x -= nx;
      this._pan.y -= ny;

      this._render();
    };

    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      const hit = this._hitTest(e.offsetX, e.offsetY);

      if (hit) {
        this._drag.active = true;
        this._drag.node = hit;
        const w = this._screenToWorld(e.offsetX, e.offsetY);
        this._drag.offsetX = hit.x - w.x;
        this._drag.offsetY = hit.y - w.y;
        hit.fx = hit.x;
        hit.fy = hit.y;
        c.style.cursor = "grabbing";
      } else {
        // pan
        this._panning.active = true;
        this._panning.startX = e.clientX;
        this._panning.startY = e.clientY;
        this._panning.panX = this._pan.x;
        this._panning.panY = this._pan.y;
        c.style.cursor = "move";
      }
    };

    this._onMouseMove = (e) => {
      if (this._drag.active && this._drag.node) {
        const w = this._screenToWorld(e.offsetX, e.offsetY);
        this._drag.node.fx = w.x + this._drag.offsetX;
        this._drag.node.fy = w.y + this._drag.offsetY;
        this._render();
        return;
      }

      if (this._panning.active) {
        const dx = e.clientX - this._panning.startX;
        const dy = e.clientY - this._panning.startY;
        this._pan.x = this._panning.panX + dx;
        this._pan.y = this._panning.panY + dy;
        this._render();
        return;
      }

      // hover cursor
      const hit = this._hitTest(e.offsetX, e.offsetY);
      c.style.cursor = hit ? "pointer" : "default";
    };

    this._onMouseUp = () => {
      if (this._drag.active && this._drag.node) {
        this._drag.node.fx = null;
        this._drag.node.fy = null;
      }
      this._drag.active = false;
      this._drag.node = null;
      this._panning.active = false;
      this._canvas.style.cursor = "default";
    };

    c.addEventListener("wheel", this._onWheel, { passive: false });
    c.addEventListener("mousedown", this._onMouseDown);
    c.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
  }

  _detachInput() {
    const c = this._canvas;
    c.removeEventListener("wheel", this._onWheel);
    c.removeEventListener("mousedown", this._onMouseDown);
    c.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
  }

  // -------------------------
  // Simulation & rendering
  // -------------------------

  _tick = () => {
    if (!this._running) return;

    for (let i = 0; i < this.opts.iterationsPerFrame; i++) {
      this._stepPhysics();
    }

    this._render();
    this._raf = requestAnimationFrame(this._tick);
  };

  _stepPhysics() {
    const nodes = this._nodes;
    const links = this._links;

    // link springs
    const k = 0.08; // spring strength
    const rest = this.opts.linkDistance;

    for (const l of links) {
      const a = this._nodeById.get(l.source);
      const b = this._nodeById.get(l.target);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;

      const force = (d - rest) * k;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;

      if (a.fx == null) {
        a.vx += fx;
        a.vy += fy;
      }
      if (b.fx == null) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // repulsion (naive O(n^2) - fine for small/medium graphs)
    const repulse = this.opts.repulsion;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 6;
        const f = repulse / d2;
        const fx = dx * f;
        const fy = dy * f;

        if (a.fx == null) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (b.fx == null) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    // pull to center
    const cx = 0;
    const cy = 0;
    for (const n of nodes) {
      if (n.fx != null && n.fy != null) {
        // fixed by dragging
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
        continue;
      }

      n.vx += (cx - n.x) * this.opts.centerPull;
      n.vy += (cy - n.y) * this.opts.centerPull;

      // damping
      n.vx *= this.opts.damping;
      n.vy *= this.opts.damping;

      n.x += n.vx;
      n.y += n.vy;
    }
  }

  _render() {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.clearRect(0, 0, w, h);

    // background subtle grid
    this._drawGrid(ctx, w, h);

    // transform for zoom/pan
    ctx.save();
    ctx.translate(this._pan.x * this._dpr, this._pan.y * this._dpr);
    ctx.scale(this._zoom * this._dpr, this._zoom * this._dpr);

    // links behind nodes
    this._drawLinks(ctx);

    // nodes
    this._drawNodes(ctx);

    ctx.restore();

    // footer legend
    this._drawLegend(ctx, w, h);
  }

  _drawGrid(ctx, w, h) {
    const step = 28 * this._dpr;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawLinks(ctx) {
    ctx.save();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";

    for (const l of this._links) {
      const a = this._nodeById.get(l.source);
      const b = this._nodeById.get(l.target);
      if (!a || !b) continue;

      // subtle curve
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const cx = mx + (b.y - a.y) * 0.08;
      const cy = my - (b.x - a.x) * 0.08;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawNodes(ctx) {
    const r = this.opts.nodeRadius;

    // draw "glow"
    for (const n of this._nodes) {
      const fill = typeColor(n.type);
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 1.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // draw main circles
    for (const n of this._nodes) {
      const fill = typeColor(n.type);
      ctx.save();

      // node body
      ctx.fillStyle = fill;
      ctx.strokeStyle = "rgba(255,255,255,0.20)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // label
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, n.x, n.y);

      // sublabel
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = '500 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial';
      ctx.fillText(n.type, n.x, n.y + r + 11);

      ctx.restore();
    }
  }

  _drawLegend(ctx, w, h) {
    const items = [
      ["SceneModel", typeColor("SceneModel")],
      ["SceneObject", typeColor("SceneObject")],
      ["SceneMesh", typeColor("SceneMesh")],
      ["SceneGeometry", typeColor("SceneGeometry")],
    ];

    const pad = 10 * this._dpr;
    const x0 = pad;
    const y0 = h - (18 * this._dpr) - pad;

    ctx.save();
    ctx.font = `600 ${11 * this._dpr}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textBaseline = "middle";

    let x = x0;
    for (const [name, color] of items) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 6 * this._dpr, y0, 5 * this._dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(name, x + 16 * this._dpr, y0);

      x += (ctx.measureText(name).width + 40 * this._dpr);
    }
    ctx.restore();
  }

  _screenToWorld(sx, sy) {
    // sx/sy are in CSS pixels within canvas
    const x = (sx - this._pan.x) / this._zoom;
    const y = (sy - this._pan.y) / this._zoom;
    return { x, y };
  }

  _hitTest(sx, sy) {
    const w = this._screenToWorld(sx, sy);
    const r = this.opts.nodeRadius;
    for (let i = this._nodes.length - 1; i >= 0; i--) {
      const n = this._nodes[i];
      const dx = w.x - n.x;
      const dy = w.y - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }
}

// -------------------------
// Graph building (defaults)
// -------------------------

function buildGraphFromScene(scene, accessors) {

  const models = accessors.getModels(scene);

  /** @type {{id:string,type:string,label:string,raw:any}[]} */
  const nodes = [];

  /** @type {{source:string,target:string}[]} */
  const links = [];

  const addNode = (id, type, label, raw) => {
    if (!id) return;
    const key = `${type}:${id}`;
    if (!seen.has(key)) {
      seen.add(key);
      nodes.push({ id: key, type, label: label ?? id, raw });
    }
    return key;
  };

  const seen = new Set();

  for (const m of models) {
    const modelId = m?.id ?? m?._id ?? "model";
    const modelKey = addNode(String(modelId), "SceneModel", shortLabel(modelId), m);

    const objects = safeArray(accessors.getObjects(m));
    for (const o of objects) {
      const objectId = o?.id ?? o?._id ?? o?.objectId ?? "object";
      const objectKey = addNode(String(objectId), "SceneObject", shortLabel(objectId), o);
      if (modelKey && objectKey) links.push({ source: modelKey, target: objectKey });

      const meshes = safeArray(accessors.getMeshes(o, m));
      for (const mesh of meshes) {
        const meshId = mesh?.id ?? mesh?._id ?? mesh?.meshId ?? "mesh";
        const meshKey = addNode(String(meshId), "SceneMesh", shortLabel(meshId), mesh);
        if (objectKey && meshKey) links.push({ source: objectKey, target: meshKey });

        const geoms = safeArray(accessors.getGeometries(mesh, o, m));
        for (const g of geoms) {
          const geomId = g?.id ?? g?._id ?? g?.geometryId ?? "geometry";
          const geomKey = addNode(String(geomId), "SceneGeometry", shortLabel(geomId), g);
          if (meshKey && geomKey) links.push({ source: meshKey, target: geomKey });
        }
      }
    }
  }

  // If we found nothing, fall back to showing a single node so the overlay isn't blank
  if (nodes.length === 0) {
    nodes.push({ id: "Scene:scene", type: "Scene", label: "Scene", raw: scene });
  }

  return { nodes, links };
}


function defaultGetModels(scene) {
  return Object.values(scene.models);
}

function defaultGetObjects(model) {
  return Object.values(model.objects);
}

function defaultGetMeshes(object, model) {
  return Object.values(object.meshes);
}

function defaultGetGeometries(mesh, _object, model) {
 return mesh.geometry ? [mesh.geometry] : [];
}


// -------------------------
// Helpers
// -------------------------

function typeColor(type) {
  switch (type) {
    case "SceneModel":
      return "rgba(99, 179, 237, 0.95)";
    case "SceneObject":
      return "rgba(251, 191, 36, 0.95)";
    case "SceneMesh":
      return "rgba(52, 211, 153, 0.95)";
    case "SceneGeometry":
      return "rgba(167, 139, 250, 0.95)";
    case "Scene":
      return "rgba(255, 255, 255, 0.45)";
    default:
      return "rgba(148, 163, 184, 0.85)";
  }
}

function shortLabel(id) {
  const s = String(id ?? "");
  if (s.length <= 6) return s;
  return s.slice(0, 3) + "…" + s.slice(-2);
}

function safeArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
