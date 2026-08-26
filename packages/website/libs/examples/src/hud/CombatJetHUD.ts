const STYLE_ID = "xeokit-combat-jet-hud-style";
const SVG_NS = "http://www.w3.org/2000/svg";

export interface CombatJetHUDState {
  airspeed?: number;
  altitude?: number;
  pitch?: number;
  bank?: number;
  heading?: number;
  cameraPreset?: string;
}

export interface CombatJetHUDModalRenderer {
  mode?: string;
  update(params: {root: Element | null; svg: SVGSVGElement | null; state: Required<CombatJetHUDState>}): void;
}

export interface CombatJetHUDParams {
  view?: any;
  readState?: () => CombatJetHUDState;
  modalRenderer?: CombatJetHUDModalRenderer | null;
  enabled?: boolean;
  visibleWhen?: (state: Required<CombatJetHUDState>) => boolean;
  id?: string;
}

type HUDRefs = Record<
  "airspeed" |
  "altitude" |
  "heading" |
  "pitch" |
  "bank" |
  "symbols" |
  "horizon" |
  "pitchLadder" |
  "bankPointer" |
  "modal",
  Element | null
>;

export function createAircraftHUDStateAdapter({view, vehicle}: {view?: any; vehicle?: any}) {
  return () => {
    const state = vehicle?.state || {};
    const position = state.visualPosition || state.position || [0, 0, 0];
    const forward = normalizeVec3(state.visualForward || state.forward || [0, 1, 0], [0, 1, 0]);
    const right = normalizeVec3(state.visualRight || state.right || [1, 0, 0], [1, 0, 0]);
    const worldUp = normalizeVec3(view?.viewer?.scene?.coordinateSystem?.worldUp || [0, 0, 1], [0, 0, 1]);
    return {
      airspeed: Math.max(0, Number(vehicle?.sdkController?.speed || 0)),
      altitude: Math.max(0, dotVec3(position, worldUp)),
      pitch: Math.asin(clamp(dotVec3(forward, worldUp), -1, 1)) * 180 / Math.PI,
      bank: Math.asin(clamp(dotVec3(right, worldUp), -1, 1)) * 180 / Math.PI,
      heading: (Math.atan2(forward[0], forward[1]) * 180 / Math.PI + 360) % 360,
      cameraPreset: state.cameraPreset || "trailing"
    };
  };
}

export function createDemoHUDModalRenderer() {
  return {
    mode: "navigation",
    update({root, svg, state}) {
      let group = root.querySelector("[data-hud-modal-demo]");
      if (!group) {
        group = svgEl("g", {"data-hud-modal-demo": "1", class: "xk-combat-hud__modal-demo"});
        group.appendChild(svgEl("rect", {x: 390, y: 524, width: 244, height: 92, rx: 0}));
        group.appendChild(svgText("NAV", 410, 548, "mode"));
        group.appendChild(svgText("BASIC FLIGHT", 410, 572, "small"));
        group.appendChild(svgText("RADAR / WPN / TERRAIN SLOT", 410, 596, "small"));
        group.appendChild(svgEl("path", {d: "M590 546 L612 568 L590 590 L568 568 Z"}));
        group.appendChild(svgEl("circle", {cx: 590, cy: 568, r: 7}));
        root.appendChild(group);
      }
      const mode = group.querySelector(".mode");
      if (mode) {
        mode.textContent = `${this.mode.toUpperCase()} ${padInt(state.heading, 3)}`;
      }
    }
  };
}

export function createCombatJetHUD(params: CombatJetHUDParams) {
  return new CombatJetHUD(params);
}

export class CombatJetHUD {
  private view: any;
  private readState: () => CombatJetHUDState;
  private modalRenderer: CombatJetHUDModalRenderer | null;
  private visibleWhen: (state: Required<CombatJetHUDState>) => boolean;
  private enabled: boolean;
  private destroyed: boolean;
  private raf: number;
  private root: HTMLDivElement;
  private svg: SVGSVGElement | null;
  private refs: HUDRefs;

  constructor({view, readState, modalRenderer = null, enabled = true, visibleWhen = defaultVisibleWhen, id = "combatJetHUD"}: CombatJetHUDParams = {}) {
    this.view = view;
    this.readState = readState || (() => ({}));
    this.modalRenderer = modalRenderer;
    this.visibleWhen = visibleWhen;
    this.enabled = enabled !== false;
    this.destroyed = false;
    this.raf = 0;
    injectStyle();
    this.root = document.createElement("div");
    this.root.id = id;
    this.root.className = "xk-combat-hud";
    this.root.setAttribute("aria-hidden", "true");
    this.root.innerHTML = markup();
    document.body.appendChild(this.root);
    this.svg = this.root.querySelector("svg");
    this.refs = collectRefs(this.root);
    this.update = this.update.bind(this);
    this.update();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.root.classList.toggle("is-disabled", !this.enabled);
  }

  setModalRenderer(renderer) {
    this.modalRenderer = renderer || null;
  }

  update() {
    if (this.destroyed) {
      return;
    }
    const state = normalizeHUDState(this.readState());
    const visible = this.enabled && this.visibleWhen(state);
    this.root.classList.toggle("is-active", visible);
    this.root.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      this.writeState(state);
      this.modalRenderer?.update?.({root: this.refs.modal, svg: this.svg, state});
    }
    this.raf = window.requestAnimationFrame(this.update);
  }

  writeState(state) {
    setText(this.refs.airspeed, padInt(state.airspeed, 3));
    setText(this.refs.altitude, padInt(state.altitude, 4));
    setText(this.refs.heading, padInt(state.heading, 3));
    setText(this.refs.pitch, signedInt(state.pitch));
    setText(this.refs.bank, signedInt(state.bank));
    setAttr(this.refs.symbols, "transform", `rotate(${-state.bank} 512 384)`);
    setAttr(this.refs.bankPointer, "transform", `rotate(${state.bank} 512 124)`);
    setAttr(this.refs.pitchLadder, "transform", `translate(0 ${clamp(state.pitch, -35, 35) * 4.2})`);
    setAttr(this.refs.horizon, "transform", `translate(0 ${clamp(state.pitch, -35, 35) * 4.2})`);
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.root.remove();
  }
}

function markup() {
  return `
    <svg class="xk-combat-hud__svg" viewBox="0 0 1024 768" preserveAspectRatio="xMidYMid meet">
      <g class="xk-combat-hud__glass">
        <path d="M204 94 H820 M204 674 H820 M176 124 V644 M848 124 V644"/>
      </g>
      <g class="xk-combat-hud__readouts">
        <text x="188" y="352" class="label">SPD</text>
        <text x="188" y="392" class="value" data-hud-airspeed>000</text>
        <path d="M168 318 H266 M168 410 H266 M168 318 V410"/>
        <text x="782" y="352" class="label">ALT</text>
        <text x="782" y="392" class="value" data-hud-altitude>0000</text>
        <path d="M758 318 H856 M856 318 V410 M758 410 H856"/>
      </g>
      <g class="xk-combat-hud__bank">
        <path d="M392 124 A120 120 0 0 1 632 124"/>
        <path d="M512 82 v20 M452 98 l8 15 M572 98 l-8 15 M414 134 h18 M592 134 h18"/>
        <path data-hud-bank-pointer d="M512 104 l-9 20 h18 Z"/>
        <text x="512" y="158" class="small center" data-hud-bank>+00</text>
      </g>
      <g data-hud-symbols>
        <g data-hud-horizon>
          <path class="horizon" d="M306 384 H468 M556 384 H718"/>
          <text x="512" y="374" class="small center">W</text>
        </g>
        <g data-hud-pitch-ladder class="xk-combat-hud__pitch-ladder">
          <path d="M392 264 H470 M554 264 H632"/><text x="374" y="270" class="tick">20</text><text x="642" y="270" class="tick">20</text>
          <path d="M420 324 H478 M546 324 H604"/><text x="374" y="330" class="tick">10</text><text x="642" y="330" class="tick">10</text>
          <path d="M360 384 H468 M556 384 H664"/>
          <path d="M420 444 H478 M546 444 H604"/><text x="368" y="450" class="tick">-10</text><text x="642" y="450" class="tick">-10</text>
          <path d="M392 504 H470 M554 504 H632"/><text x="368" y="510" class="tick">-20</text><text x="642" y="510" class="tick">-20</text>
        </g>
        <g class="xk-combat-hud__fpm">
          <circle cx="512" cy="384" r="18"/>
          <path d="M464 384 H494 M530 384 H560 M512 366 V342"/>
        </g>
        <g class="xk-combat-hud__aim">
          <path d="M512 292 V326 M512 442 V476 M420 384 H454 M570 384 H604"/>
        </g>
      </g>
      <g class="xk-combat-hud__heading">
        <path d="M412 694 H612 M512 678 V704"/>
        <text x="512" y="724" class="value center" data-hud-heading>000</text>
      </g>
      <text x="92" y="704" class="small">PITCH <tspan data-hud-pitch>+00</tspan></text>
      <g class="xk-combat-hud__modal" data-hud-modal>
        <path class="modal-frame" d="M374 508 H650 V632 H374 Z M392 524 H632 V616 H392 Z"/>
      </g>
    </svg>`;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .xk-combat-hud {
      --hud-color: #6cff86;
      position: fixed;
      inset: 0;
      z-index: 100100010;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms linear;
      display: grid;
      place-items: center;
      contain: layout style paint;
    }
    .xk-combat-hud.is-active { opacity: 1; }
    .xk-combat-hud__svg {
      width: min(88vw, 980px);
      height: min(82vh, 720px);
      overflow: visible;
      color: var(--hud-color);
      filter: drop-shadow(0 0 5px rgba(108,255,134,.88));
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 21px;
      font-weight: 600;
    }
    .xk-combat-hud path,
    .xk-combat-hud circle,
    .xk-combat-hud rect {
      fill: none;
      stroke: currentColor;
      stroke-width: 2.25;
      vector-effect: non-scaling-stroke;
    }
    .xk-combat-hud text {
      fill: currentColor;
      paint-order: stroke;
      stroke: rgba(0, 18, 8, .55);
      stroke-width: 3.4px;
      vector-effect: non-scaling-stroke;
    }
    .xk-combat-hud .value { font-size: 34px; }
    .xk-combat-hud .label,
    .xk-combat-hud .small,
    .xk-combat-hud .tick { font-size: 17px; }
    .xk-combat-hud .center { text-anchor: middle; }
    .xk-combat-hud__glass { opacity: .34; }
    .xk-combat-hud__modal {
      opacity: .72;
      stroke-dasharray: 7 9;
    }
    .xk-combat-hud__modal-demo rect {
      fill: rgba(0, 28, 12, .24);
      stroke-opacity: .88;
    }
    .xk-combat-hud__modal-demo text { font-size: 16px; }
    .xk-combat-hud__modal-demo .mode { font-size: 18px; }
    @media (max-width: 680px) {
      .xk-combat-hud__svg {
        width: 96vw;
        height: 92vh;
        font-size: 18px;
      }
      .xk-combat-hud .value { font-size: 28px; }
      .xk-combat-hud .label,
      .xk-combat-hud .small,
      .xk-combat-hud .tick { font-size: 14px; }
    }`;
  document.head.appendChild(style);
}

function collectRefs(root) {
  return {
    airspeed: root.querySelector("[data-hud-airspeed]"),
    altitude: root.querySelector("[data-hud-altitude]"),
    heading: root.querySelector("[data-hud-heading]"),
    pitch: root.querySelector("[data-hud-pitch]"),
    bank: root.querySelector("[data-hud-bank]"),
    symbols: root.querySelector("[data-hud-symbols]"),
    horizon: root.querySelector("[data-hud-horizon]"),
    pitchLadder: root.querySelector("[data-hud-pitch-ladder]"),
    bankPointer: root.querySelector("[data-hud-bank-pointer]"),
    modal: root.querySelector("[data-hud-modal]")
  };
}

function normalizeHUDState(state) {
  return {
    airspeed: Number(state?.airspeed || 0),
    altitude: Number(state?.altitude || 0),
    pitch: Number(state?.pitch || 0),
    bank: Number(state?.bank || 0),
    heading: Number(state?.heading || 0),
    cameraPreset: state?.cameraPreset || "trailing"
  };
}

function defaultVisibleWhen(state) {
  return state.cameraPreset === "cockpit";
}

function svgEl(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function svgText(text, x, y, className) {
  const element = svgEl("text", {x, y, class: className});
  element.textContent = text;
  return element;
}

function setText(element, value) {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function setAttr(element, name, value) {
  if (element && element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function padInt(value, size) {
  return Math.round(Number(value) || 0).toString().padStart(size, "0");
}

function signedInt(value) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded >= 0 ? "+" : "-"}${Math.abs(rounded).toString().padStart(2, "0")}`;
}

function normalizeVec3(value, fallback) {
  if (!value || value.length < 3) {
    return fallback;
  }
  const x = Number(value[0] || 0);
  const y = Number(value[1] || 0);
  const z = Number(value[2] || 0);
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= 0.000001) {
    return fallback;
  }
  return [x / length, y / length, z / length];
}

function dotVec3(a, b) {
  return Number(a?.[0] || 0) * Number(b?.[0] || 0) +
    Number(a?.[1] || 0) * Number(b?.[1] || 0) +
    Number(a?.[2] || 0) * Number(b?.[2] || 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}
