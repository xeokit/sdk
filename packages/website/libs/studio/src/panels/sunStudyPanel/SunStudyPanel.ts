import type {SunStudy} from "@xeokit/website-presentations/sunStudy";
import {AnnualSunPlayer} from "@xeokit/website-presentations/sunStudy";
import {
  SITE_PRESET_CITIES,
  SITE_PRESET_REFERENCES,
  findMatchingPreset,
} from "./sitePresets";
import {
  worldMapSvg,
  clientPointToLatLon,
  latLonToViewBox,
} from "./worldMap";
import {el} from "../../utils/el";
import {FloatingPanelBase, type FloatingPanelBaseParams} from "../floatingPanelBase";


/**
 * Constructor parameters for {@link SunStudyPanel | SunStudyPanel}.
 *
 */
export interface SunStudyPanelParams {

  /** Required. Two-way-bound to the panel. */
  sunStudy: SunStudy;

  /** Optional player — when provided, the panel exposes play / pause
   *  controls + a mode toggle (day / year). When omitted, the panel
   *  is read-only / scrub-only. */
  player?: AnnualSunPlayer;

  container?: HTMLElement;
  storageKey?: string;
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-sun-styles";
let _stylesInjected = false;

const PANEL_CSS = `
.xkt-sun-panel {
  position: fixed;
  top: 17px;
  left: 17px;
  width: 380px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  color: #111;
  z-index: 200000000;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-sun-panel *, .xkt-sun-panel *::before, .xkt-sun-panel *::after { box-sizing: inherit; }
.xkt-sun-panel[hidden] { display: none; }

.xkt-sun-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 12px 16px;
  border-bottom: 1px solid #ececec;
  flex: 0 0 auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.xkt-sun-header.xkt-sun-dragging { cursor: grabbing; }
.xkt-sun-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-sun-title-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: #f4a020;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-sun-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-sun-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sun-close {
  appearance: none;
  background: transparent;
  border: 0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: #666;
}
.xkt-sun-close:hover { color: #111; background: #f0f0f0; }

.xkt-sun-body {
  padding: 10px 12px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.xkt-sun-section-title {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #888;
  margin: 2px 0 2px 0;
  font-weight: 600;
}

.xkt-sun-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.xkt-sun-row label {
  flex: 0 0 78px;
  font-size: 11px;
  color: #444;
}
.xkt-sun-row input[type="number"] {
  flex: 1;
  font: inherit;
  padding: 2px 6px;
  border: 1px solid #d8dde6;
  border-radius: 4px;
  background: white;
  min-width: 0;
}
.xkt-sun-row input[type="range"] {
  flex: 1;
}
.xkt-sun-row .xkt-sun-val {
  width: 70px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #555;
  font-size: 11px;
}
.xkt-sun-preset {
  flex: 1;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid #d0d4da;
  border-radius: 4px;
  background: white;
  min-width: 0;
}
.xkt-sun-locatebtn {
  appearance: none;
  background: #eef2f7;
  border: 1px solid #d0d4da;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #2d5e8c;
  white-space: nowrap;
}
.xkt-sun-locatebtn:hover:not(:disabled) { background: #e3e9f1; }
.xkt-sun-locatebtn:disabled { opacity: 0.6; cursor: progress; }
.xkt-sun-locate-status {
  font-size: 11px;
  color: #b03030;
  margin-left: 8px;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sun-map {
  margin: 6px 0 8px;
  border: 1px solid #d0d4da;
  border-radius: 4px;
  overflow: hidden;
  background: #bcd5ec;
  /* Plate-Carrée natural ratio is 2:1; we let the SVG fill the
     full panel width and a generous fixed height so the map
     reads as a proper geographic widget, not a thin strip. */
  height: 200px;
  position: relative;
}
.xkt-sun-map-svg {
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
}

.xkt-sun-playbtn {
  appearance: none;
  background: #f4a020;
  color: white;
  border: 0;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.xkt-sun-playbtn:hover { background: #db8c0e; }
.xkt-sun-mode {
  display: flex;
  background: #eef2f7;
  border-radius: 4px;
  padding: 2px;
  gap: 0;
}
.xkt-sun-mode button {
  appearance: none;
  background: transparent;
  border: 0;
  font: inherit;
  padding: 3px 10px;
  cursor: pointer;
  border-radius: 3px;
  color: #555;
}
.xkt-sun-mode button.xkt-sun-mode-active {
  background: white;
  color: #111;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
`;

function injectStylesOnce(): void {
  if (_stylesInjected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}


// ─────────────────────────────────────────────────────────────────────


/**
 * Floating panel for editing a {@link presentations!sunStudy.SunStudy | SunStudy}'s
 * geo-location + date / time cursor, with optional play / pause /
 * day-vs-year mode controls when an {@link presentations!sunStudy.AnnualSunPlayer | AnnualSunPlayer}
 * is supplied.
 *
 * Two-way bound — the panel's inputs write back to the SunStudy (and
 * the SunStudy's `onChanged` event re-syncs the panel readouts).
 *
 */
export class SunStudyPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<SunStudy, SunStudyPanel>();

  /**
   * Most recently opened panel — used by the toolbar's Present
   * group to operate on whichever SunStudy the application is
   * currently driving without needing the toolbar to carry a
   * direct reference. Cleared on destroy when the current slot
   * matches.
   */
  private static _latest: SunStudyPanel | null = null;

  /**
   * Returns the most recently opened SunStudyPanel, or `undefined`
   * when none is open. The Toolbar's "Sun Study" button uses this
   * so the user can toggle the panel from the Toolbar even though
   * the Toolbar has no direct {@link SunStudy} reference.
   */
  static getLatest(): SunStudyPanel | undefined {
    const inst = SunStudyPanel._latest;
    return inst && !inst._destroyed ? inst : undefined;
  }

  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="12" cy="12" r="5" fill="currentColor"/>` +
      `<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">` +
        `<line x1="12" y1="2"  x2="12" y2="5"/>` +
        `<line x1="12" y1="19" x2="12" y2="22"/>` +
        `<line x1="2"  y1="12" x2="5"  y2="12"/>` +
        `<line x1="19" y1="12" x2="22" y2="12"/>` +
        `<line x1="4.5"  y1="4.5"  x2="6.7" y2="6.7"/>` +
        `<line x1="17.3" y1="17.3" x2="19.5" y2="19.5"/>` +
        `<line x1="4.5"  y1="19.5" x2="6.7" y2="17.3"/>` +
        `<line x1="17.3" y1="6.7"  x2="19.5" y2="4.5"/>` +
      `</g>` +
    `</svg>`;
  }

  static getFor(study: SunStudy): SunStudyPanel | undefined {
    const inst = SunStudyPanel._instances.get(study);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: SunStudyPanelParams): SunStudyPanel {
    let inst = SunStudyPanel._instances.get(params.sunStudy);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new SunStudyPanel(params);
    return inst;
  }

  public readonly sunStudy: SunStudy;

  /**
   * The {@link AnnualSunPlayer} driving the Playback section. If the
   * caller didn't supply one (e.g. the toolbar cold-start path), the
   * panel constructs a default player against `sunStudy` and owns
   * its lifetime — destroying the panel destroys the player. When
   * the caller supplies their own player, the panel doesn't own it
   * and {@link destroy} leaves it intact.
   */
  public readonly player: AnnualSunPlayer;

  /** True when the player was constructed by the panel (so destroy
   *  should tear it down). False when the caller passed their own. */
  private _ownsPlayer: boolean;

  // DOM refs.
  private _presetSelect!: HTMLSelectElement;
  private _locateBtn!:    HTMLButtonElement;
  private _locateStatus!: HTMLSpanElement;
  private _mapSvg!:       SVGSVGElement;
  private _pinGroup!:     SVGGElement;
  private _latInput!: HTMLInputElement;
  private _lonInput!: HTMLInputElement;
  private _northInput!: HTMLInputElement;
  private _datePicker!: HTMLInputElement;
  private _hourSlider!: HTMLInputElement;
  private _hourReadout!: HTMLSpanElement;
  private _altReadout!: HTMLSpanElement;
  private _azReadout!: HTMLSpanElement;
  private _playBtn!:    HTMLButtonElement;
  private _modeDay!:    HTMLButtonElement;
  private _modeYear!:   HTMLButtonElement;
  private _nightExpSlider!:  HTMLInputElement;
  private _nightExpReadout!: HTMLSpanElement;

  private _unsubStudy: (() => void) | null = null;
  private _unsubPlay:  (() => void) | null = null;
  private _unsubPause: (() => void) | null = null;

  constructor(params: SunStudyPanelParams) {
    if (!params || !params.sunStudy) {
      throw new Error("SunStudyPanel: sunStudy is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-sun-panel",
      classPrefix: "xkt-sun",
    } as FloatingPanelBaseParams);

    this.sunStudy = params.sunStudy;
    // Auto-construct a default player when the caller didn't pass
    // one — the Playback section should always be available
    // (cold-start through the toolbar, demo apps that just want
    // a Sun Study panel without connecting playback themselves).
    if (params.player) {
      this.player     = params.player;
      this._ownsPlayer = false;
    } else {
      this.player     = new AnnualSunPlayer({sunStudy: params.sunStudy});
      this._ownsPlayer = true;
    }

    const prior = SunStudyPanel._instances.get(params.sunStudy);
    if (prior && !prior._destroyed) prior.destroy();
    SunStudyPanel._instances.set(params.sunStudy, this);
    SunStudyPanel._latest = this;

    injectStylesOnce();
    this._buildDom();
    this._wireDomEvents();
    this._subscribeStudy();
    this._refreshFromStudy();

    if (params.visible === false) this.hide();
  }

  protected _buildDom(): void {
    this._panel = el("div", "xkt-sun-panel");

    this._header = el("div", "xkt-sun-header");
    const title = el("h2", "xkt-sun-title");
    title.innerHTML =
      `<span class="xkt-sun-title-icon">${SunStudyPanel.iconSvg()}</span>` +
      `<span class="xkt-sun-title-text">Sun Study</span>`;
    this._closeBtn = el("button", "xkt-sun-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);

    this._pill = el("button", "xkt-sun-pill", {
      type:        "button",
      hidden:      true,
      textContent: "Sun Study",
    }) as HTMLButtonElement;

    const body = el("div", "xkt-sun-body");

    body.appendChild(this._sectionTitle("Site"));

    // Preset picker — flat <select> with two <optgroup>s (cities +
    // reference latitudes). Native typeahead works (typing the
    // first character jumps to matching entries). Selecting any
    // entry commits to lat/lon and triggers the existing SunStudy
    // setters, which then flow back to the inputs via `_refreshFromStudy`.
    const presetRow = this._row("Preset");
    this._presetSelect = el("select", "xkt-sun-preset") as HTMLSelectElement;
    const placeholder = el("option") as HTMLOptionElement;
    placeholder.value = "";
    placeholder.textContent = "— Custom —";
    this._presetSelect.appendChild(placeholder);

    const citiesGroup = el("optgroup") as HTMLOptGroupElement;
    citiesGroup.label = "Cities";
    for (const p of SITE_PRESET_CITIES) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = p.label;
      opt.textContent = p.label;
      citiesGroup.appendChild(opt);
    }
    this._presetSelect.appendChild(citiesGroup);

    const refsGroup = el("optgroup") as HTMLOptGroupElement;
    refsGroup.label = "Reference latitudes";
    for (const p of SITE_PRESET_REFERENCES) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = p.label;
      opt.textContent = p.label;
      refsGroup.appendChild(opt);
    }
    this._presetSelect.appendChild(refsGroup);
    presetRow.appendChild(this._presetSelect);
    body.appendChild(presetRow);

    // Geolocation row — one-click "use my coordinates". Status
    // span doubles as the error sink (permission denied,
    // unsupported, timeout) so the user knows why nothing happened.
    const locateRow = this._row("");
    this._locateBtn = el("button", "xkt-sun-locatebtn", {
      type:        "button",
      textContent: "📍 Use my location",
      title:       "Set latitude / longitude from the browser geolocation API",
    }) as HTMLButtonElement;
    this._locateStatus = el("span", "xkt-sun-locate-status") as HTMLSpanElement;
    locateRow.append(this._locateBtn, this._locateStatus);
    body.appendChild(locateRow);

    // Click-to-pick world map. Plate Carrée projection — pixel
    // ↔ lat/lon is `(u * 360 - 180, 90 - v * 180)`. A native HTML
    // container wraps the inline-parsed SVG so click handlers
    // attach cleanly.
    const mapWrap = el("div", "xkt-sun-map");
    mapWrap.innerHTML = worldMapSvg();
    this._mapSvg   = mapWrap.querySelector("svg")  as SVGSVGElement;
    this._pinGroup = mapWrap.querySelector("#pin") as SVGGElement;
    body.appendChild(mapWrap);

    const latRow = this._row("Latitude");
    this._latInput = this._numberInput(-90, 90, 0.01);
    latRow.appendChild(this._latInput);
    body.appendChild(latRow);

    const lonRow = this._row("Longitude");
    this._lonInput = this._numberInput(-180, 180, 0.01);
    lonRow.appendChild(this._lonInput);
    body.appendChild(lonRow);

    const northRow = this._row("North (°)");
    this._northInput = this._numberInput(-360, 360, 1);
    northRow.appendChild(this._northInput);
    body.appendChild(northRow);

    body.appendChild(this._sectionTitle("Cursor"));

    const dateRow = this._row("Date");
    this._datePicker = el("input", "", { type: "date" }) as HTMLInputElement;
    dateRow.appendChild(this._datePicker);
    body.appendChild(dateRow);

    const hourRow = this._row("Time (UTC)");
    this._hourSlider = el("input", "", {
      type: "range", min: "0", max: "1439", step: "1", value: "720",
    }) as HTMLInputElement;
    this._hourReadout = el("span", "xkt-sun-val") as HTMLSpanElement;
    hourRow.append(this._hourSlider, this._hourReadout);
    body.appendChild(hourRow);

    body.appendChild(this._sectionTitle("Playback"));
    const playRow = this._row("");
    this._playBtn = el("button", "xkt-sun-playbtn", {
      type: "button",
      textContent: "▶ Play",
    }) as HTMLButtonElement;
    const modeWrap = el("div", "xkt-sun-mode");
    this._modeDay  = el("button", "", { type: "button", textContent: "Day" })  as HTMLButtonElement;
    this._modeYear = el("button", "", { type: "button", textContent: "Year" }) as HTMLButtonElement;
    modeWrap.append(this._modeDay, this._modeYear);
    playRow.append(this._playBtn, modeWrap);
    body.appendChild(playRow);

    body.appendChild(this._sectionTitle("Sun"));

    const altRow = this._row("Altitude");
    this._altReadout = el("span", "xkt-sun-val") as HTMLSpanElement;
    altRow.appendChild(this._altReadout);
    body.appendChild(altRow);

    const azRow = this._row("Azimuth");
    this._azReadout = el("span", "xkt-sun-val") as HTMLSpanElement;
    azRow.appendChild(this._azReadout);
    body.appendChild(azRow);

    // Night exposure factor — the "how dark at night" control that
    // multiplies `view.effects.tonemap.exposure` at the deep-night
    // end of the twilight lerp. Live-driven through the SunStudy
    // setter so dragging the slider updates exposure on the next
    // `_apply()` without needing a cursor change.
    body.appendChild(this._sectionTitle("Night"));
    const expRow = this._row("Exposure");
    this._nightExpSlider = el("input", "xkt-sun-slider", {
      type:  "range",
      min:   "0",
      max:   "1",
      step:  "0.01",
    }) as HTMLInputElement;
    this._nightExpReadout = el("span", "xkt-sun-val") as HTMLSpanElement;
    expRow.append(this._nightExpSlider, this._nightExpReadout);
    body.appendChild(expRow);

    this._panel.append(this._header, body);
    this._container.append(this._pill, this._panel);

    this._bindChrome();
  }

  protected _wireDomEvents(): void {
    this._closeBtn.addEventListener("click", () => this.hide());

    this._presetSelect.addEventListener("change", () => {
      const label = this._presetSelect.value;
      if (!label) return;   // user picked the "— Custom —" placeholder
      const preset =
        SITE_PRESET_CITIES.find    (p => p.label === label) ??
        SITE_PRESET_REFERENCES.find(p => p.label === label);
      if (!preset) return;
      this.sunStudy.setLocation(preset.latitude, preset.longitude);
    });

    this._locateBtn.addEventListener("click", () => this._locate());

    this._mapSvg.addEventListener("click", (ev) => {
      const {latitude, longitude} = clientPointToLatLon(this._mapSvg, ev.clientX, ev.clientY);
      this.sunStudy.setLocation(latitude, longitude);
    });

    this._latInput.addEventListener("change", () => {
      const v = parseFloat(this._latInput.value);
      if (Number.isFinite(v)) this.sunStudy.latitude = v;
    });
    this._lonInput.addEventListener("change", () => {
      const v = parseFloat(this._lonInput.value);
      if (Number.isFinite(v)) this.sunStudy.longitude = v;
    });
    this._northInput.addEventListener("change", () => {
      const v = parseFloat(this._northInput.value);
      if (Number.isFinite(v)) this.sunStudy.northAngleDegrees = v;
    });

    this._datePicker.addEventListener("change", () => {
      const yymmdd = this._datePicker.value; // "YYYY-MM-DD"
      if (!yymmdd) return;
      const cur = this.sunStudy.currentDate;
      const [y, m, d] = yymmdd.split("-").map(Number);
      const next = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1,
        cur.getUTCHours(), cur.getUTCMinutes(), 0, 0));
      this.sunStudy.setDateMs(next.getTime());
    });
    this._hourSlider.addEventListener("input", () => {
      const minutes = parseInt(this._hourSlider.value, 10);
      const cur = this.sunStudy.currentDate;
      const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate(),
        Math.floor(minutes / 60), minutes % 60, 0, 0));
      this.sunStudy.setDateMs(next.getTime());
    });

    this._playBtn.addEventListener("click", () => {
      if (this.player.playing) this.player.pause();
      else                     this.player.play();
    });
    this._modeDay.addEventListener("click",  () => this.player.mode = "day");
    this._modeYear.addEventListener("click", () => this.player.mode = "year");

    this._nightExpSlider.addEventListener("input", () => {
      const v = parseFloat(this._nightExpSlider.value);
      if (Number.isFinite(v)) this.sunStudy.nightExposureFactor = v;
    });
  }

  /**
   * Geolocation-API click handler. Browsers gate this behind a
   * permission prompt + HTTPS-only on non-localhost. On success
   * the lat/lon flow through `sunStudy.setLocation`, which fires
   * `onChanged`, which `_refreshFromStudy` picks up and propagates
   * to every input including the preset dropdown.
   */
  private _locate(): void {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      this._locateStatus.textContent = "Geolocation unavailable";
      return;
    }
    this._locateBtn.disabled = true;
    this._locateStatus.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this._locateBtn.disabled = false;
        this._locateStatus.textContent = "";
        this.sunStudy.setLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        this._locateBtn.disabled = false;
        // Map the GeolocationPositionError codes to terse labels —
        // the panel is too narrow for the full browser message.
        const map: Record<number, string> = {
          1: "Permission denied",
          2: "Position unavailable",
          3: "Timed out",
        };
        this._locateStatus.textContent = map[err.code] ?? "Failed";
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  private _subscribeStudy(): void {
    this._unsubStudy = this.sunStudy.onChanged.subscribe(() => this._refreshFromStudy());
    this._unsubPlay  = this.player.onPlay.subscribe(()  => this._refreshPlayBtn());
    this._unsubPause = this.player.onPause.subscribe(() => this._refreshPlayBtn());
  }

  private _refreshFromStudy(): void {
    this._latInput.value   = this.sunStudy.latitude.toFixed(4);
    this._lonInput.value   = this.sunStudy.longitude.toFixed(4);
    this._northInput.value = this.sunStudy.northAngleDegrees.toFixed(1);

    // Keep the preset dropdown in sync with current coords. Falls
    // back to the "— Custom —" placeholder when no preset matches
    // — that's the signal to the user that the inputs hold a
    // hand-edited site that won't be found in the dropdown.
    const matched = findMatchingPreset(this.sunStudy.latitude, this.sunStudy.longitude);
    this._presetSelect.value = matched ?? "";

    // Pin → current site. The pin's local origin is its TIP, so
    // translating the group to the lat/lon pixel puts the point
    // exactly on the coordinate.
    const pos = latLonToViewBox(this.sunStudy.latitude, this.sunStudy.longitude);
    this._pinGroup.setAttribute("transform", `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`);

    const d = this.sunStudy.currentDate;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    this._datePicker.value = `${yyyy}-${mm}-${dd}`;

    const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    this._hourSlider.value = String(minutes);
    this._hourReadout.textContent = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

    const p = this.sunStudy.sunPosition;
    this._altReadout.textContent = `${p.altitude.toFixed(1)}°`;
    this._azReadout.textContent  = `${p.azimuth.toFixed(1)}°`;

    const nef = this.sunStudy.nightExposureFactor;
    this._nightExpSlider.value      = nef.toFixed(2);
    this._nightExpReadout.textContent = nef.toFixed(2);

    this._refreshModeBtns();
  }

  private _refreshPlayBtn(): void {
    this._playBtn.textContent = this.player.playing ? "❚❚ Pause" : "▶ Play";
  }

  private _refreshModeBtns(): void {
    const m = this.player.mode;
    this._modeDay.classList.toggle ("xkt-sun-mode-active", m === "day");
    this._modeYear.classList.toggle("xkt-sun-mode-active", m === "year");
  }

  // ── DOM-creation helpers ─────────────────────────────────────────

  private _sectionTitle(text: string): HTMLElement {
    const e = el("div", "xkt-sun-section-title");
    e.textContent = text;
    return e;
  }

  private _row(labelText: string): HTMLElement {
    const row = el("div", "xkt-sun-row");
    if (labelText) {
      const lbl = el("label");
      lbl.textContent = labelText;
      row.appendChild(lbl);
    }
    return row;
  }

  private _numberInput(min: number, max: number, step: number): HTMLInputElement {
    return el("input", "", {
      type: "number",
      min:  String(min),
      max:  String(max),
      step: String(step),
    }) as HTMLInputElement;
  }

  public override destroy(): void {
    if (this._destroyed) return;
    this._unsubStudy?.(); this._unsubStudy = null;
    this._unsubPlay?.();  this._unsubPlay  = null;
    this._unsubPause?.(); this._unsubPause = null;
    // Tear down the player only when the panel owns it (auto-
    // constructed in the constructor because the caller didn't
    // supply one). A caller-supplied player has its own lifetime.
    if (this._ownsPlayer) this.player.destroy();
    SunStudyPanel._instances.delete(this.sunStudy);
    if (SunStudyPanel._latest === this) SunStudyPanel._latest = null;
    super.destroy();
  }
}
