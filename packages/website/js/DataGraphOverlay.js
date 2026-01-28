/**
 * DataGraphOverlay
 *
 * Floating, absolutely-positioned overlay that renders an entity–relationship style
 * graph for xeokit semantic Data:
 *
 *   Data -> DataModel -> DataObject -> PropertySet -> Property
 *                 \-> Relationship edges between DataObjects (optional)
 *
 * Rendering tech: HTML5 Canvas (force-directed layout + zoom/pan + dragging)
 *
 * Usage:
 *   const er = new DataGraphOverlay(data, { right: 16, top: 16, width: 620, height: 420 });
 *   er.start();
 *   // After you load/import data:
 *   er.refresh();
 *   // Cleanup:
 *   er.destroy();
 */
export class DataGraphOverlay {
  /**
   * @param {object} data xeokit Data instance
   * @param {object} [opts]
   */
  constructor(data, opts = {}) {
    this.data = data;

    this.opts = {
      // overlay placement
      left: opts.left ?? null,
      right: opts.right ?? 16,
      top: opts.top ?? 16,
      bottom: opts.bottom ?? null,
      width: opts.width ?? 620,
      height: opts.height ?? 420,
      zIndex: opts.zIndex ?? 999999,

      // look & feel
      title: opts.title ?? "Data ER Diagram",
      background: opts.background ?? "rgba(14, 18, 24, 0.86)",
      border: opts.border ?? "1px solid rgba(255,255,255,0.10)",
      textColor: opts.textColor ?? "rgba(255,255,255,0.92)",
      subtleTextColor: opts.subtleTextColor ?? "rgba(255,255,255,0.65)",

      // graph tuning
      linkDistance: opts.linkDistance ?? 115,
      repulsion: opts.repulsion ?? 1700,
      centerPull: opts.centerPull ?? 0.055,
      damping: opts.damping ?? 0.90,
      iterationsPerFrame: opts.iterationsPerFrame ?? 2,

      // ER/size controls (important for large models)
      maxModels: opts.maxModels ?? 20,
      maxObjectsPerModel: opts.maxObjectsPerModel ?? 120,
      maxPropertySetsPerModel: opts.maxPropertySetsPerModel ?? 120,
      maxPropertiesPerSet: opts.maxPropertiesPerSet ?? 30,
      includeRelationships: opts.includeRelationships ?? true,
      maxRelationshipEdges: opts.maxRelationshipEdges ?? 250,
      relationshipTypeAllowlist: opts.relationshipTypeAllowlist ?? null, // array of strings or null
      showPropertyNodes: opts.showPropertyNodes ?? true, // set false to only show PropertySet nodes

      // optional: override how we read Data structures
      accessors: {
        getModels: opts.accessors?.getModels ?? defaultGetModels,
        getModelObjects: opts.accessors?.getModelObjects ?? defaultGetModelObjects,
        getModelPropertySets: opts.accessors?.getModelPropertySets ?? defaultGetModelPropertySets,
        getPropertySetProperties: opts.accessors?.getPropertySetProperties ?? defaultGetPropertySetProperties,
        getModelRelationships: opts.accessors?.getModelRelationships ?? defaultGetModelRelationships,
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

    const graph = (typeof buildGraph === "function")
      ? buildGraph(this.data, this.opts)
      : buildGraphFromData(this.data, this.opts);

    const { nodes, links } = graph;

    // preserve positions for stable layout when refreshing
    const prev = new Map(this._nodes.map((n) => [n.id, n]));

    this._nodes = nodes.map((n) => {
      const p = prev.get(n.id);
      return {
        ...n,
        x: p?.x ?? (Math.random() - 0.5) * 260,
        y: p?.y ?? (Math.random() - 0.5) * 180,
        vx: p?.vx ?? 0,
        vy: p?.vy ?? 0,
        fx: p?.fx ?? null,
        fy: p?.fy ?? null,
      };
    });

    this._links = links.map((l) => ({ ...l }));
    this._nodeById = new Map(this._nodes.map((n) => [n.id, n]));

    // initial pan
    this._pan.x = this._pan.x || this._canvas.width / (2 * this._dpr);
    this._pan.y = this._pan.y || (this._headerHeight + (this._canvas.height / this._dpr - this._headerHeight) / 2);

    this._render();
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

    root.appendChild(header);
    root.appendChild(canvas);
    document.body.appendChild(root);

    this._root = root;
    this._header = header;
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");
    this._headerHeight = 44;

    this._enableWindowDrag();

    this._onResize = () => this._resizeCanvas();
    window.addEventListener("resize", this._onResize);
    this._resizeCanvas();

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

    // Springs
    const k = 0.075;
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

      if (a.fx == null) { a.vx += fx; a.vy += fy; }
      if (b.fx == null) { b.vx -= fx; b.vy -= fy; }
    }

    // Repulsion (naive O(n^2), OK for limited node counts)
    const repulse = this.opts.repulsion;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 8;
        const f = repulse / d2;
        const fx = dx * f;
        const fy = dy * f;

        if (a.fx == null) { a.vx -= fx; a.vy -= fy; }
        if (b.fx == null) { b.vx += fx; b.vy += fy; }
      }
    }

    // Pull to origin
    for (const n of nodes) {
      if (n.fx != null && n.fy != null) {
        n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0;
        continue;
      }
      n.vx += (0 - n.x) * this.opts.centerPull;
      n.vy += (0 - n.y) * this.opts.centerPull;

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

    this._drawGrid(ctx, w, h);

    ctx.save();
    ctx.translate(this._pan.x * this._dpr, this._pan.y * this._dpr);
    ctx.scale(this._zoom * this._dpr, this._zoom * this._dpr);

    this._drawLinks(ctx);
    this._drawNodes(ctx);

    ctx.restore();

    this._drawLegend(ctx, w, h);
  }

  _drawGrid(ctx, w, h) {
    const step = 28 * this._dpr;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
    ctx.restore();
  }

  _drawLinks(ctx) {
    ctx.save();

    for (const l of this._links) {
      const a = this._nodeById.get(l.source);
      const b = this._nodeById.get(l.target);
      if (!a || !b) continue;

      // relationship edges styled differently
      const isRel = l.kind === "Relationship";
      ctx.lineWidth = isRel ? 1.5 : 1.15;
      ctx.strokeStyle = isRel ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.18)";

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const cx = mx + (b.y - a.y) * 0.08;
      const cy = my - (b.x - a.x) * 0.08;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, b.x, b.y);
      ctx.stroke();

      // optional label (relationship type)
      if (isRel && l.label) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial';
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(l.label, cx, cy - 2);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  _drawNodes(ctx) {
    // ER nodes look nicer as rounded rectangles with a tiny “type pill”
    for (const n of this._nodes) {
      const { w, h } = n.box;
      const x = n.x - w / 2;
      const y = n.y - h / 2;

      const fill = typeColor(n.type);
      const stroke = "rgba(255,255,255,0.18)";

      // glow
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = fill;
      roundRect(ctx, x - 5, y - 5, w + 10, h + 10, 10);
      ctx.fill();
      ctx.restore();

      // main
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();

      // label
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(n.label, x + 10, y + 9);

      // type line
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial';
      ctx.fillText(n.type, x + 10, y + 26);

      // optional subtitle (e.g., object.type or propertySet.type)
      if (n.subLabel) {
        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial';
        ctx.fillText(n.subLabel, x + 10, y + 41);
      }

      ctx.restore();
    }
  }

  _drawLegend(ctx, w, h) {
    const items = [
      ["Data", typeColor("Data")],
      ["DataModel", typeColor("DataModel")],
      ["DataObject", typeColor("DataObject")],
      ["PropertySet", typeColor("PropertySet")],
      ["Property", typeColor("Property")],
      ["Relationship", "rgba(255,255,255,0.32)"],
    ];

    const pad = 10 * this._dpr;
    let x = pad;
    const y = h - (18 * this._dpr) - pad;

    ctx.save();
    ctx.font = `600 ${11 * this._dpr}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.textBaseline = "middle";

    for (const [name, color] of items) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 6 * this._dpr, y, 5 * this._dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(name, x + 16 * this._dpr, y);

      x += (ctx.measureText(name).width + 40 * this._dpr);
      if (x > w - 120 * this._dpr) break;
    }

    ctx.restore();
  }

  _screenToWorld(sx, sy) {
    const x = (sx - this._pan.x) / this._zoom;
    const y = (sy - this._pan.y) / this._zoom;
    return { x, y };
  }

  _hitTest(sx, sy) {
    const w = this._screenToWorld(sx, sy);
    for (let i = this._nodes.length - 1; i >= 0; i--) {
      const n = this._nodes[i];
      const { w: bw, h: bh } = n.box;
      const x0 = n.x - bw / 2;
      const y0 = n.y - bh / 2;
      if (w.x >= x0 && w.x <= x0 + bw && w.y >= y0 && w.y <= y0 + bh) return n;
    }
    return null;
  }
}

// -------------------------
// Graph building (defaults)
// -------------------------

function buildGraphFromData(data, opts) {
  const A = opts.accessors;

  const modelsAll = valuesFromAnyCollection(A.getModels(data));
  const models = modelsAll.slice(0, opts.maxModels);

  const nodes = [];
  const links = [];
  const seen = new Set();

  const addNode = (id, type, label, subLabel, raw) => {
    if (!id) return null;
    const key = `${type}:${id}`;
    if (!seen.has(key)) {
      seen.add(key);
      const box = estimateBox(label, subLabel);
      nodes.push({ id: key, type, label, subLabel, raw, box });
    }
    return key;
  };

  const dataKey = addNode("data", "Data", "Data", "", data);

  // Track propertySet nodes so objects can link to them even if they’re shared
  const propertySetKeyById = new Map();
  const objectKeyById = new Map();

  // Data -> DataModels
  for (const m of models) {
    const mid = String(m?.id ?? m?._id ?? "model");
    const mKey = addNode(mid, "DataModel", shortLabel(mid), m?.name ? String(m.name) : "", m);
    if (dataKey && mKey) links.push({ source: dataKey, target: mKey, kind: "Contains", label: "" });

    // DataModel -> PropertySets
    const psAll = valuesFromAnyCollection(A.getModelPropertySets(m));
    const ps = psAll.slice(0, opts.maxPropertySetsPerModel);

    for (const pset of ps) {
      const pid = String(pset?.id ?? pset?._id ?? "pset");
      const pKey = addNode(pid, "PropertySet", shortLabel(pid), pset?.type ? String(pset.type) : "", pset);
      propertySetKeyById.set(pid, pKey);
      if (mKey && pKey) links.push({ source: mKey, target: pKey, kind: "HasPropertySet", label: "" });

      // PropertySet -> Properties (optional)
      if (opts.showPropertyNodes) {
        const propsAll = valuesFromAnyCollection(A.getPropertySetProperties(pset));
        const props = propsAll.slice(0, opts.maxPropertiesPerSet);
        for (const prop of props) {
          const propId = `${pid}:${prop?.name ?? "prop"}`;
          const propLabel = String(prop?.name ?? "Property");
          const sub = (prop?.valueType != null) ? String(prop.valueType) : (prop?.type ? String(prop.type) : "");
          const prKey = addNode(propId, "Property", shortLabel(propLabel), sub, prop);
          if (pKey && prKey) links.push({ source: pKey, target: prKey, kind: "HasProperty", label: "" });
        }
      }
    }

    // DataModel -> DataObjects
    const objsAll = valuesFromAnyCollection(A.getModelObjects(m));
    const objs = objsAll.slice(0, opts.maxObjectsPerModel);

    for (const o of objs) {
      const oid = String(o?.id ?? o?._id ?? "obj");
      const label = o?.name ? String(o.name) : shortLabel(oid);
      const sub = o?.type ? String(o.type) : "";
      const oKey = addNode(oid, "DataObject", shortLabel(label), sub, o);
      objectKeyById.set(oid, oKey);
      if (mKey && oKey) links.push({ source: mKey, target: oKey, kind: "Contains", label: "" });

      // DataObject -> PropertySets (by reference)
      const objPS = valuesFromAnyCollection(o?.propertySets);
      for (const pset of objPS) {
        const pid = String(pset?.id ?? pset?._id ?? "");
        const pKey = propertySetKeyById.get(pid) ?? addNode(pid, "PropertySet", shortLabel(pid), pset?.type ? String(pset.type) : "", pset);
        if (pid) propertySetKeyById.set(pid, pKey);
        if (oKey && pKey) links.push({ source: oKey, target: pKey, kind: "References", label: "" });
      }
    }

    // DataObject <-> DataObject relationships (optional)
    if (opts.includeRelationships) {
      const relAll = valuesFromAnyCollection(A.getModelRelationships(m));
      let added = 0;

      for (const r of relAll) {
        if (added >= opts.maxRelationshipEdges) break;

        const rType = String(r?.type ?? "");
        if (opts.relationshipTypeAllowlist && Array.isArray(opts.relationshipTypeAllowlist)) {
          if (!opts.relationshipTypeAllowlist.includes(rType)) continue;
        }

        const fromId = String(r?.relatingObject?.id ?? "");
        const toId = String(r?.relatedObject?.id ?? "");
        if (!fromId || !toId) continue;

        const fromKey = objectKeyById.get(fromId) ?? addNode(fromId, "DataObject", shortLabel(fromId), r?.relatingObject?.type ? String(r.relatingObject.type) : "", r?.relatingObject);
        const toKey = objectKeyById.get(toId) ?? addNode(toId, "DataObject", shortLabel(toId), r?.relatedObject?.type ? String(r.relatedObject.type) : "", r?.relatedObject);

        if (fromKey && toKey) {
          links.push({ source: fromKey, target: toKey, kind: "Relationship", label: rType });
          added++;
        }
      }
    }
  }

  // If we found nothing, show Data node only
  if (nodes.length === 0) {
    nodes.push({ id: "Data:data", type: "Data", label: "Data", subLabel: "", raw: data, box: estimateBox("Data", "") });
  }

  return { nodes, links };
}

// -------------------------
// Default accessors (xeokit Data shape)
// -------------------------

function defaultGetModels(data) {
  // Data.models is a plain object in the provided implementation
  return data?.models ?? {};
}

function defaultGetModelObjects(dataModel) {
  // DataModel.objects is a plain object
  return dataModel?.objects ?? {};
}

function defaultGetModelPropertySets(dataModel) {
  // DataModel.propertySets is a plain object
  return dataModel?.propertySets ?? {};
}

function defaultGetPropertySetProperties(propertySet) {
  // PropertySet.properties is an array
  return propertySet?.properties ?? [];
}

function defaultGetModelRelationships(dataModel) {
  // DataModel.relationships is an array
  return dataModel?.relationships ?? [];
}

// -------------------------
// Helpers
// -------------------------

function valuesFromAnyCollection(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (x instanceof Map || x instanceof Set) return Array.from(x.values());
  if (typeof x[Symbol.iterator] === "function") return Array.from(x);
  if (typeof x === "object") return Object.values(x);
  return [];
}

function typeColor(type) {
  switch (type) {
    case "Data":
      return "rgba(99, 179, 237, 0.35)";
    case "DataModel":
      return "rgba(99, 179, 237, 0.95)";
    case "DataObject":
      return "rgba(251, 191, 36, 0.92)";
    case "PropertySet":
      return "rgba(52, 211, 153, 0.92)";
    case "Property":
      return "rgba(167, 139, 250, 0.90)";
    default:
      return "rgba(148, 163, 184, 0.80)";
  }
}

function shortLabel(s) {
  const t = String(s ?? "");
  if (t.length <= 10) return t;
  return t.slice(0, 7) + "…" + t.slice(-2);
}

function estimateBox(label, subLabel) {
  // crude but decent: widths based on character counts
  const base = 110;
  const extra = Math.max(label.length, (subLabel || "").length) * 6.2;
  const w = clamp(base + extra, 120, 260);
  const lines = subLabel ? 3 : 2;
  const h = lines === 3 ? 60 : 48;
  return { w, h };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
