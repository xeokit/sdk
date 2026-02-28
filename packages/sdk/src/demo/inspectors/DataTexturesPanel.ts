import type { DataTextures } from "../../webglrenderer/internal/gpuMemoryManager/DataTextures";
import { SDKTaskRunner } from "../../core";

// Small DOM util
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, any> | null,
  children?: (HTMLElement | string | SVGElement)[]
): HTMLElement {
  const e = document.createElement(tag);
  if (props) {
    for (const k in props) {
      if (k.startsWith("data-")) {
        e.setAttribute(k, String((props as any)[k] ?? ""));
        continue;
      }
      if (k === "style" && (props as any)[k] && typeof (props as any)[k] === "object") {
        Object.assign((e as any).style, (props as any)[k]);
        continue;
      }
      (e as any)[k] = (props as any)[k];
    }
  }
  if (children) for (const c of children) e.append(c);
  return e;
}

export class DataTexturesPanel {
  static #TILE_ID = "__dtxpanel_tile__";
  static #STYLE_ID = "__dtxpanel_style__";
  static #STATE_KEY = "__dtxpanel_collapsed__";

  // JSON overlay ids
  static #JSON_MODAL_ID = "__dtxpanel_json_modal__";
  static #JSON_BACKDROP_ID = "__dtxpanel_json_backdrop__";

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
    const root = el("div", { className: "taskpanel-root dtxp-root", ["data-dtxp-root" as any]: "" });

    const collapsed = this.#readBool(this.#STATE_KEY, !!opts.startCollapsed);

    const header = this.renderHeader(dataTextures, opts, collapsed);
    const body = this.renderBody(dataTextures);

    root.appendChild(header);
    root.appendChild(body);

    this.#setCollapsed(root, collapsed);

    // Toggle collapse (header button)
    header.querySelector<HTMLButtonElement>("[data-dtxp-toggle]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const nowCollapsed = !root.classList.contains("dtxp-collapsed");
      this.#setCollapsed(root, nowCollapsed);
      this.#writeBool(this.#STATE_KEY, nowCollapsed);

      const btn = header.querySelector<HTMLButtonElement>("[data-dtxp-toggle]");
      if (btn) btn.textContent = nowCollapsed ? "Expand" : "Collapse";
    });

    return root;
  }

  static renderHeader(dataTextures: DataTextures, _opts: any = {}, collapsed = false) {
    return el("div", { className: "taskpanel-header dtxp-header" }, [
      el("img", {
        className: "shins-title-icon dtxp-title-icon",
        width: 60,
        height: 60,
        alt: "Data textures icon",
        src: this.icon(),
        draggable: false,
      }),
      el("div", { className: "taskpanel-title-col dtxp-title-col" }, [
        el("div", { className: "taskpanel-h1 dtxp-h1", textContent: "GPU Data Textures" }),
        el("div", {
          className: "taskpanel-subtitle dtxp-subtitle",
          textContent:
            "Performance diagnostics for data textures, which store model and viewer state in GPU memory.",
        }),
      ]),
      // Right side actions (kept fully visible even when collapsed)
      el("div", { className: "dtxp-actions" }, [
        el("button", {
          className: "dtxp-btn dtxp-btn--sub",
          ["data-dtxp-toggle" as any]: "",
          textContent: collapsed ? "Expand" : "Collapse",
          title: collapsed ? "Show panel contents" : "Hide panel contents",
        }),
      ]),
    ]);
  }

  static renderBody(dataTextures: DataTextures) {
    const root = el("div", { className: "datatextures-root dtxp-body", ["data-dtxp-body" as any]: "" });

    // Summary
    root.append(
      el("div", { className: "datatextures-summary" }, [
        el("div", { className: "datatextures-summary-row" }, [
          el("span", { className: "datatextures-summary-label" }, ["Tiles: "]),
          String(dataTextures.numTiles),
        ]),
        el("div", { className: "datatextures-summary-row" }, [
          el("span", { className: "datatextures-summary-label" }, ["Batches: "]),
          String(dataTextures.batches.length),
        ]),
        el("div", { className: "datatextures-summary-row" }, [
          el("span", { className: "datatextures-summary-label" }, ["Views: "]),
          String(dataTextures.viewTileCameraMatrixTexture.length),
        ]),
      ])
    );

    // Global per-view textures
    root.append(
      el("div", { className: "datatextures-section" }, [
        el("div", { className: "datatextures-section-title" }, ["Global Per-View Textures"]),
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
      const stress = this.#batchStressInfo(batch);

      summary.append(el("span", { className: "datatextures-caret" }, ["▸"]), ` Batch ${batchIdx}`);

      if (stress.stressed) {
        summary.append(
          el("span", { className: "datatextures-chip datatextures-chip-stress" }, [
            `MEM STRESS (${stress.stressedCount})`,
          ])
        );
      }
      details.appendChild(summary);

      // Per-batch textures
      details.appendChild(
        el("div", { className: "datatextures-batch-tablewrap" }, [
          this.renderTextureTable(
            Object.entries(batch)
              // @ts-ignore
              .filter(
                ([, v]) =>
                  Array.isArray(v) === false &&
                  typeof v === "object" &&
                  v &&
                  typeof (v as any).getItem === "function"
              )
              .map(([k, v]) => ({ name: k, arr: [v] }))
          ),
        ])
      );

      // Per-view textures in batch
      if (Array.isArray((batch as any).views)) {
        (batch as any).views.forEach((view: any, viewIdx: number) => {
          const vdetails = document.createElement("details");
          vdetails.open = false;
          vdetails.className = "datatextures-view-section";
          const vsummary = document.createElement("summary");
          vsummary.className = "datatextures-view-summary";

          const vstress = this.#viewStressInfo(view);
          if (vstress.stressed) vsummary.classList.add("datatextures-view-stressed");

          vsummary.append(
            el("span", { className: "datatextures-caret" }, ["▸"]),
            el("span", { className: "datatextures-summary-title", textContent: `View ${viewIdx}` }),
            el("span", { className: "datatextures-summary-spacer" })
          );

          if (vstress.stressed) {
            vsummary.append(
              el("span", { className: "datatextures-chip datatextures-chip-stress" }, [
                `MEM STRESS (${vstress.stressedCount})`,
              ]),
              el("span", { className: "datatextures-chip datatextures-chip-stress-lite" }, [
                `max ${(vstress.maxFullness * 100).toFixed(0)}%`,
              ])
            );
          }

          vdetails.appendChild(vsummary);

          vdetails.appendChild(
            el("div", { className: "datatextures-view-tablewrap" }, [
              this.renderTextureTable(
                Object.entries(view)
                  // @ts-ignore
                  .filter(([, v]) => v && typeof (v as any).getItem === "function")
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

  // -----------------------------
  // JSON overlay (floating DIV)
  // -----------------------------
  static #closeJsonOverlay() {
    try {
      document.getElementById(this.#JSON_MODAL_ID)?.remove();
      document.getElementById(this.#JSON_BACKDROP_ID)?.remove();
    } catch {}
  }

  static #ensureJsonOverlay(title: string, jsonText: string) {
    // Remove any existing overlay first
    this.#closeJsonOverlay();

    const backdrop = el("div", {
      id: this.#JSON_BACKDROP_ID,
      className: "dtx-json-backdrop",
      onclick: (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.#closeJsonOverlay();
      },
    } as any) as HTMLDivElement;

    const modal = el("div", { id: this.#JSON_MODAL_ID, className: "dtx-json-modal" } as any) as HTMLDivElement;

    const header = el("div", { className: "dtx-json-header" }, [
      el("div", { className: "dtx-json-title", textContent: title }),
      el("div", { className: "dtx-json-actions" }, [
        el("button", {
          className: "dtxp-btn dtxp-btn--sub",
          type: "button",
          textContent: "Copy",
          title: "Copy JSON to clipboard",
          onclick: async (ev: MouseEvent) => {
            ev.preventDefault();
            ev.stopPropagation();
            try {
              await navigator.clipboard.writeText(jsonText);
            } catch {
              // ignore (clipboard may be blocked)
            }
          },
        }),
        el("button", {
          className: "dtxp-btn dtxp-btn--sub",
          type: "button",
          textContent: "Close",
          title: "Close JSON viewer",
          onclick: (ev: MouseEvent) => {
            ev.preventDefault();
            ev.stopPropagation();
            this.#closeJsonOverlay();
          },
        }),
      ]),
    ]);

    const pre = el("pre", { className: "dtx-json-pre", textContent: jsonText });

    modal.appendChild(header);
    modal.appendChild(pre);

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    // Escape closes
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        this.#closeJsonOverlay();
      }
      // stop if overlay removed
      if (!document.getElementById(this.#JSON_MODAL_ID)) {
        window.removeEventListener("keydown", onKeyDown, true);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
  }

  static #showTextureJson(tex: any, title: string) {
    let payload: any;
    try {
      if (!tex || typeof tex.getItems !== "function") {
        payload = { error: "getItems() not available on this texture" };
      } else {
        payload = tex.getItems();
      }
    } catch (err: any) {
      payload = {
        error: "getItems() threw",
        message: String(err?.message ?? err),
        stack: String(err?.stack ?? ""),
      };
    }

    let jsonText = "";
    try {
      jsonText = JSON.stringify(payload, null, 2);
    } catch (err: any) {
      jsonText = JSON.stringify(
        {
          error: "JSON.stringify failed",
          message: String(err?.message ?? err),
        },
        null,
        2
      );
    }

    this.#ensureJsonOverlay(title, jsonText);
  }

  static renderTextureTable(items: { name: string; arr: any[] }[]) {
    const table = el("table", {
      className: "datatextures-table datatextures-table-hybrid",
    });

    // ------------------------------------------------------------
    // HEADER
    // ------------------------------------------------------------

    const thead = el("thead", null, [
      el("tr", null, [
        el("th", null, ["Name"]),
        el("th", null, ["Type"]),
        el("th", null, ["JSON"]),
        el("th", null, ["Capacity"]),
        el("th", null, ["Used"]),
      ]),
    ]);

    table.appendChild(thead);
    const tbody = el("tbody");

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------

    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

    const heatColor = (t: number) => {
      const c = clamp01(t);
      const hue = 120 * (1 - c); // green → red
      return `hsl(${hue} 80% 45%)`;
    };

    const safeCall = <T,>(obj: any, fn: string, fallback: T): T => {
      try {
        if (obj && typeof obj[fn] === "function") return obj[fn]();
      } catch {}
      return fallback;
    };

    const toNumber = (v: any, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

    const fmtBytes = (b: number) => {
      if (!Number.isFinite(b)) return String(b);
      const abs = Math.abs(b);
      if (abs >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GiB`;
      if (abs >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(2)} MiB`;
      if (abs >= 1024) return `${(b / 1024).toFixed(2)} KiB`;
      return `${b} B`;
    };

    const makePropGrid = (pairs: Array<[string, string]>) => {
      const dl = el("dl", { className: "dtx-props" });
      for (const [k, v] of pairs) {
        dl.append(
          el("div", { className: "dtx-prop" }, [
            el("dt", { className: "dtx-prop-k", textContent: k }),
            el("dd", { className: "dtx-prop-v", textContent: v }),
          ])
        );
      }
      return dl;
    };

    const toggle = (summaryTr: HTMLTableRowElement, detailTr: HTMLTableRowElement) => {
      const open = summaryTr.getAttribute("data-open") === "1";
      if (open) {
        summaryTr.setAttribute("data-open", "0");
        detailTr.style.display = "none";
      } else {
        summaryTr.setAttribute("data-open", "1");
        detailTr.style.display = "";
      }
    };

    // ------------------------------------------------------------
    // ROWS
    // ------------------------------------------------------------

    for (const { name, arr } of items) {
      arr.forEach((tex: any, idx: number) => {
        const type = tex.description || tex.constructor?.name || "Texture";

        const usedCount = tex.numItems;
        const capacityCount = tex.maxItems;
        const fullness = capacityCount > 0 ? usedCount / capacityCount : 0;
        const pct = Math.round(clamp01(fullness) * 100);

        const title = arr.length > 1 ? `${name} #${idx}` : name;

        // JSON button cell (opens floating overlay)
        const jsonBtn = el("button", {
          className: "dtxp-btn dtxp-btn--sub",
          type: "button",
          textContent: "JSON",
          title: "Show tex.getItems() in a floating viewer",
          onclick: (ev: MouseEvent) => {
            ev.preventDefault();
            ev.stopPropagation(); // don't toggle expand/collapse
            DataTexturesPanel.#showTextureJson(tex, `${title} — getItems()`);
          },
        });

        // --------------------------
        // SUMMARY ROW
        // --------------------------

        const summaryTr = el(
          "tr",
          {
            className: "dtx-row",
            "data-open": "0",
          } as any,
          [
            el("td", { className: "dtx-namecell" }, [
              el("span", { className: "dtx-caret", textContent: "▸" }),
              el("span", { className: "dtx-title", textContent: title }),
              el("span", { className: "dtx-pct", textContent: `${pct}%` }),
            ]),
            el("td", null, [type]),
            el("td", { className: "dtx-jsoncell" }, [jsonBtn]),
            el("td", {
              className: "dtx-capacity",
              textContent: capacityCount.toLocaleString(),
            }),
            el(
              "td",
              {
                className: "dtx-usedcell",
                style: `--dtx-color:${heatColor(fullness)}; --dtx-fill:${pct}%;`,
                title: `${usedCount.toLocaleString()} / ${capacityCount.toLocaleString()} items`,
              },
              [
                el("span", {
                  className: "dtx-usedtext",
                  textContent: usedCount.toLocaleString(),
                }),
                el("span", { className: "dtx-usedbar" }),
              ]
            ),
          ]
        ) as HTMLTableRowElement;

        // --------------------------
        // DETAIL ROW (expanded)
        // --------------------------

        const allocatedBytes = toNumber(safeCall<number>(tex, "getAllocatedBytes", 0), 0);
        const usedBytes = toNumber(safeCall<number>(tex, "getUsedBytes", 0), 0);

        const usedItems = toNumber(tex?.numItems, 0);
        const maxItems = toNumber(tex?.maxItems, 0);

        const width = toNumber(tex?.width, 0);
        const height = toNumber(tex?.height, 0);

        const texelsPerItem = toNumber(tex?.texelsPerItem, 0);
        const elementsPerTexel = toNumber(tex?.elementsPerTexel, 0);
        const elementsPerItem = toNumber(tex?.elementsPerItem, 0);

        const bytesPerTexel = toNumber(tex?.bytesPerTexel, 0);
        const itemSizeInBytes = toNumber(tex?.itemSizeInBytes, 0);

        const totalTexels = Math.max(0, width * height);
        const usedTexels = Math.max(0, Math.min(totalTexels, usedItems * Math.max(1, texelsPerItem)));

        const bufferLen = toNumber(tex?.buffer?.length, 0);
        const bufferClassName = tex?.bufferClass?.name || tex?.buffer?.constructor?.name || "";

        const gl = tex?.gl as WebGL2RenderingContext | null;

        const fmtEnum = (v: any) => {
          const n = toNumber(v, NaN);
          if (!Number.isFinite(n)) return String(v);
          const hex = `0x${n.toString(16)}`;
          return `${n} (${hex})`;
        };

        const glName = (v: number) => {
          if (!gl || !Number.isFinite(v)) return "";
          const common: Record<number, string> = {
            [gl.RGBA]: "RGBA",
            [gl.RGB]: "RGB",
            [gl.RED]: "RED",
            [gl.RED_INTEGER]: "RED_INTEGER",
            [gl.RGBA_INTEGER]: "RGBA_INTEGER",

            [gl.UNSIGNED_BYTE]: "UNSIGNED_BYTE",
            [gl.UNSIGNED_SHORT]: "UNSIGNED_SHORT",
            [gl.UNSIGNED_INT]: "UNSIGNED_INT",
            [gl.FLOAT]: "FLOAT",
            // @ts-ignore
            [gl.HALF_FLOAT ?? -1]: "HALF_FLOAT",

            // @ts-ignore
            [gl.RGBA8 ?? -1]: "RGBA8",
            // @ts-ignore
            [gl.RGBA16F ?? -1]: "RGBA16F",
            // @ts-ignore
            [gl.RGBA32F ?? -1]: "RGBA32F",
            // @ts-ignore
            [gl.RGBA32UI ?? -1]: "RGBA32UI",
            // @ts-ignore
            [gl.RGBA16UI ?? -1]: "RGBA16UI",
            // @ts-ignore
            [gl.R32F ?? -1]: "R32F",
            // @ts-ignore
            [gl.RG32F ?? -1]: "RG32F",
          };
          return common[v] || "";
        };

        const fmtGl = (v: any) => {
          const n = toNumber(v, NaN);
          if (!Number.isFinite(n)) return String(v);
          const name = glName(n);
          return name ? `${name} (${fmtEnum(n)})` : fmtEnum(n);
        };

        const fmtBool = (b: any) => (b ? "true" : "false");

        const capacityPairs: Array<[string, string]> = [
          ["Capacity (items)", maxItems.toLocaleString()],
          ["Used (items)", usedItems.toLocaleString()],
          ["Free (items)", Math.max(0, maxItems - usedItems).toLocaleString()],
          ["Utilization", `${pct}%`],
          ["Used texels", usedTexels.toLocaleString()],
          ["Total texels", totalTexels.toLocaleString()],
        ];

        if (allocatedBytes) capacityPairs.push(["Allocated (memory)", fmtBytes(allocatedBytes)]);
        if (usedBytes) capacityPairs.push(["Used (memory)", fmtBytes(usedBytes)]);

        const layoutPairs: Array<[string, string]> = [
          ["Description", String(tex?.description || "")],
          ["Width × Height", `${width.toLocaleString()} × ${height.toLocaleString()}`],
          ["Texels / item", texelsPerItem.toLocaleString()],
          ["Elements / texel", elementsPerTexel.toLocaleString()],
          ["Elements / item", elementsPerItem.toLocaleString()],
          ["Bytes / texel", bytesPerTexel ? bytesPerTexel.toLocaleString() : String(bytesPerTexel)],
          ["Bytes / item", itemSizeInBytes ? itemSizeInBytes.toLocaleString() : String(itemSizeInBytes)],
        ];

        const webglPairs: Array<[string, string]> = [
          ["Format", fmtGl(tex?.format)],
          ["Type", fmtGl(tex?.type)],
          ["Internal format", fmtGl(tex?.internalFormat)],
          ["Filtering", "NEAREST / NEAREST"],
          ["Wrap", "CLAMP_TO_EDGE"],
        ];

        const bufferPairs: Array<[string, string]> = [
          ["Buffer class", bufferClassName || "(unknown)"],
          ["Buffer length", bufferLen ? bufferLen.toLocaleString() : String(bufferLen)],
          ["Expected length", (width * height * Math.max(1, elementsPerTexel)).toLocaleString()],
        ];

        const runtimePairs: Array<[string, string]> = [
          ["Last upload (ms)", toNumber(tex?.lastUploadTimeMS, 0).toFixed(3)],
          ["Debugging", fmtBool(tex?.debugging)],
          ["Has WebGL texture", tex?.texture ? "true" : "false"],
          ["Has GL context", tex?.gl ? "true" : "false"],
        ];

        const section = (title: string, pairs: Array<[string, string]>) =>
          el("div", { className: "dtx-detailsection" }, [
            el("div", { className: "dtx-subhdr", textContent: title }),
            makePropGrid(pairs),
          ]);

        const detailContent = el("div", { className: "dtx-detailwrap" }, [
          el("div", { className: "dtx-detailhdr", textContent: "DataTexture Details" }),

          el("div", { className: "dtx-detailpreviewrow" }, [this.#makePreviewCanvas(tex, 600, "large")]),
          el("div", { className: "dtx-detailpreviewhint" }, [
            "Preview shows occupancy of CPU buffer mapped to texels; unused capacity is dimmed.",
          ]),

          section("Capacity", capacityPairs),
          section("Layout", layoutPairs),
          section("WebGL", webglPairs),
          section("Buffer", bufferPairs),
          section("Runtime", runtimePairs),
        ]);

        const detailTr = el(
          "tr",
          {
            className: "dtx-detailrow",
          } as any,
          [
            el(
              "td",
              {
                colSpan: 5,
                className: "dtx-detailcell",
              } as any,
              [detailContent]
            ),
          ]
        ) as HTMLTableRowElement;

        detailTr.style.display = "none";

        // --------------------------
        // Interactions
        // --------------------------

        summaryTr.addEventListener("click", () => toggle(summaryTr, detailTr));

        summaryTr.tabIndex = 0;
        summaryTr.addEventListener("keydown", (ev: KeyboardEvent) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            toggle(summaryTr, detailTr);
          }
        });

        tbody.appendChild(summaryTr);
        tbody.appendChild(detailTr);
      });
    }

    table.appendChild(tbody);
    return table;
  }

  static #previewCache = new WeakMap<any, { thumb?: HTMLCanvasElement; large?: HTMLCanvasElement }>();

  static #clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
  }

  static #renderTexturePreview(tex: any, canvas: HTMLCanvasElement, targetW: number) {
    const w = Math.max(1, this.#toNumber(tex?.width, 0));
    const h = Math.max(1, this.#toNumber(tex?.height, 0));
    const ept = Math.max(1, this.#toNumber(tex?.elementsPerTexel, 1));
    const buffer: any = tex?.buffer;

    // Compute preview height to preserve aspect ratio
    const aspect = h / w;
    const targetH = 10 * Math.max(1, Math.round(targetW * aspect));

    const ctx = canvas.getContext("2d");
    canvas.width = targetW;
    canvas.height = targetH;

    if (!ctx || !buffer || typeof buffer.length !== "number" || w <= 0 || h <= 0) {
      if (ctx) {
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.font = "10px system-ui";
        ctx.fillText("n/a", 6, 14);
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.strokeRect(0.5, 0.5, targetW - 1, targetH - 1);
      }
      return;
    }

    const totalTexels = w * h;
    const usedTexels = Math.max(
      0,
      Math.min(totalTexels, this.#toNumber(tex?.numItems, 0) * this.#toNumber(tex?.texelsPerItem, 1))
    );

    const img = ctx.createImageData(targetW, targetH);
    const data = img.data;

    const abs = Math.abs;
    const eps = 1e-12;

    const occupied = (texelIndex: number) => {
      const base = texelIndex * ept;
      for (let c = 0; c < ept; c++) {
        const v = Number(buffer[base + c] ?? 0);
        if (!Number.isFinite(v)) continue;
        if (abs(v) > eps) return 1;
      }
      return 0;
    };

    for (let py = 0; py < targetH; py++) {
      const yy = Math.floor((py / targetH) * h);
      for (let px = 0; px < targetW; px++) {
        const xx = Math.floor((px / targetW) * w);
        const texelIndex = yy * w + xx;

        const occ = occupied(texelIndex) === 1;

        let r = 0,
          g = 0,
          b = 0,
          a = 255;

        if (occ) {
          r = 0;
          g = 220;
          b = 255;
          a = 255;
        } else {
          r = 6;
          g = 6;
          b = 8;
          a = 255;
        }

        if (texelIndex >= usedTexels) {
          r = Math.round(r * 0.18 + 10);
          g = Math.round(g * 0.18 + 10);
          b = Math.round(b * 0.18 + 12);
          a = 120;
        }

        const i = (py * targetW + px) * 4;
        data[i + 0] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }

    ctx.putImageData(img, 0, 0);

    // Checkerboard behind (helps read alpha)
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(0.5, 0.5, targetW - 1, targetH - 1);

    ctx.globalCompositeOperation = "destination-over";
    const s = 8;
    for (let y = 0; y < targetH; y += s) {
      for (let x = 0; x < targetW; x += s) {
        ctx.fillStyle = (x / s + y / s) % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.10)";
        ctx.fillRect(x, y, s, s);
      }
    }
    ctx.globalCompositeOperation = "source-over";

    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.strokeRect(0.5, 0.5, targetW - 1, targetH - 1);
  }

  static #makePreviewCanvas(tex: any, size: number, kind: "thumb" | "large") {
    let rec = this.#previewCache.get(tex);
    if (!rec) {
      rec = {};
      this.#previewCache.set(tex, rec);
    }

    const existing = kind === "thumb" ? rec.thumb : rec.large;
    if (existing) return existing;

    const canvas = document.createElement("canvas");
    canvas.className = kind === "thumb" ? "dtx-preview" : "dtx-preview-large";

    if (kind === "thumb") {
      canvas.width = size;
      canvas.height = size;
      requestAnimationFrame(() => this.#renderTexturePreview(tex, canvas, size));
    } else {
      canvas.width = size;
      canvas.height = 10 * Math.max(1, Math.round(size * ((tex?.height ?? 1) / (tex?.width ?? 1))));
      requestAnimationFrame(() => this.#renderTexturePreview(tex, canvas, size));
    }

    if (kind === "thumb") rec.thumb = canvas;
    else rec.large = canvas;

    return canvas;
  }

  static #STRESS_THRESHOLD = 0.9; // >= 90% full => "red"/stress

  static #isTextureLike(v: any) {
    return !!(v && typeof v === "object" && typeof v.getItem === "function");
  }

  static #toNumber(v: any, fallback = 0) {
    return Number.isFinite(Number(v)) ? Number(v) : fallback;
  }

  static #textureFullness(tex: any) {
    const used = this.#toNumber(tex?.numItems, 0);
    const cap = this.#toNumber(tex?.maxItems, 0);
    if (cap <= 0) return 0;
    return used / cap;
  }

  static #batchStressInfo(batch: any) {
    let stressedCount = 0;
    let maxFullness = 0;

    const consider = (tex: any) => {
      const f = this.#textureFullness(tex);
      if (f > maxFullness) maxFullness = f;
      if (f >= this.#STRESS_THRESHOLD) stressedCount++;
    };

    for (const [, v] of Object.entries(batch)) {
      if (Array.isArray(v)) continue;
      if (!this.#isTextureLike(v)) continue;
      consider(v);
    }

    if (Array.isArray((batch as any).views)) {
      for (const view of (batch as any).views) {
        if (!view || typeof view !== "object") continue;
        for (const [, v] of Object.entries(view)) {
          if (!this.#isTextureLike(v)) continue;
          consider(v);
        }
      }
    }

    return { stressed: stressedCount > 0, stressedCount, maxFullness };
  }

  static #viewStressInfo(view: any) {
    let stressedCount = 0;
    let maxFullness = 0;

    const consider = (tex: any) => {
      const f = this.#textureFullness(tex);
      if (f > maxFullness) maxFullness = f;
      if (f >= this.#STRESS_THRESHOLD) stressedCount++;
    };

    if (view && typeof view === "object") {
      for (const [, v] of Object.entries(view)) {
        if (!this.#isTextureLike(v)) continue;
        consider(v);
      }
    }

    return { stressed: stressedCount > 0, stressedCount, maxFullness };
  }

  static icon() {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
  <rect x="4" y="4" width="52" height="52" rx="12"
        fill="#fff" stroke="#e6e6e6" stroke-width="1.5"/>

  <path d="M15 38 A15 15 0 0 1 45 38"
        fill="none"
        stroke="url(#grad)"
        stroke-width="6"
        stroke-linecap="round"/>

  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4fd1c5"/>
      <stop offset="60%" stop-color="#f6ad55"/>
      <stop offset="100%" stop-color="#e53e3e"/>
    </linearGradient>
  </defs>

  <line x1="30" y1="38" x2="42" y2="28"
        stroke="#2d5e8c"
        stroke-width="2"
        stroke-linecap="round"/>
  <circle cx="30" cy="38" r="3" fill="#2d5e8c"/>
</svg>`.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  static #setCollapsed(root: HTMLElement, collapsed: boolean) {
    root.classList.toggle("dtxp-collapsed", collapsed);
    const body = root.querySelector<HTMLElement>("[data-dtxp-body]");
    if (body) body.style.display = collapsed ? "none" : "block";
  }

  static #readBool(key: string, fallback: boolean) {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw == null) return fallback;
      return raw === "1";
    } catch {
      return fallback;
    }
  }

  static #writeBool(key: string, value: boolean) {
    try {
      sessionStorage.setItem(key, value ? "1" : "0");
    } catch {}
  }

  static #ensureStyle() {
    if ((window as any).__datatextures_panel_style) return;

    const style = document.createElement("style");
    style.textContent = `
/* Panel container */
.datatextures-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }

/* Header layout: keep fully visible even when collapsed */
.dtxp-header {
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
.dtxp-title-icon { width: 60px; height: 60px; flex: 0 0 60px; border-radius: 14px; border: 1.5px solid #e6e6e6; background: #fafafa; padding: 6px; }
.dtxp-title-col { display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 4px; }
.dtxp-h1 { padding-top: 10px; font-size: 24px; color: #666666; font-weight: 650; }
.dtxp-subtitle { font-size: 12px; color: #444; line-height: 1.35; }
.dtxp-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; padding-top: 2px; }

.dtxp-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.dtxp-btn:hover { background: #fafafa; }
.dtxp-btn--sub { padding: 5px 8px; border-radius: 10px; font-size: 11px; }

/* Summary */
.datatextures-summary { display: flex; gap: 32px; margin-bottom: 18px; }
.datatextures-summary-row { font-size: 15px; }
.datatextures-summary-label { color: #2d5e8c; font-weight: 650; }

/* Sections */
.datatextures-section { margin-bottom: 18px; }
.datatextures-section-title { font-size: 16px; font-weight: 650; color: #2d5e8c; margin-bottom: 8px; }

/* Tables */
.datatextures-table { border-collapse: collapse; width: 100%; font-size: 14px; margin-bottom: 8px; }
.datatextures-table th, .datatextures-table td { border: 1px solid #e6e6e6; padding: 4px 10px; }
.datatextures-table th { background: #f7fafc; color: #2d5e8c; font-weight: 650; }

.datatextures-batch-section, .datatextures-view-section { border: 1px solid #e6e6e6; border-radius: 10px; background: #fff; margin-bottom: 12px; margin-left: 15px; margin-right: 15px; }
.datatextures-batch-summary, .datatextures-view-summary { cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 650; color: #2d5e8c; padding: 10px 14px 8px 14px; user-select: none; outline: none; }
.datatextures-caret { font-size: 16px; color: #888; transition: transform 0.18s cubic-bezier(.4,0,.2,1); display: inline-block; width: 18px; text-align: center; }
.datatextures-batch-section[open] > .datatextures-batch-summary > .datatextures-caret,
.datatextures-view-section[open] > .datatextures-view-summary > .datatextures-caret { transform: rotate(90deg); }
.datatextures-batch-tablewrap, .datatextures-view-tablewrap { padding: 0 14px 10px 14px; }
.datatextures-table-hybrid .dtx-row { cursor: pointer; }
.datatextures-table-hybrid .dtx-row:focus { outline: 2px solid rgba(45,94,140,0.25); outline-offset: -2px; }

.dtx-namecell { display: flex; align-items: center; gap: 8px; }
.dtx-caret { width: 18px; text-align: center; color: #888; transition: transform 0.18s cubic-bezier(.4,0,.2,1); flex: 0 0 auto; }
.dtx-row[data-open="1"] .dtx-caret { transform: rotate(90deg); }

.dtx-title { color: #2d5e8c; font-weight: 650; }
.dtx-pct { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 750; color: #111; }

.dtx-usedcell { position: relative; }
.dtx-usedtext { font-variant-numeric: tabular-nums; font-weight: 650; }
.dtx-usedbar {
  display: block;
  margin-top: 4px;
  height: 8px;
  border-radius: 999px;
  background: #f0f3f6;
  border: 1px solid #e6e6e6;
  overflow: hidden;
  position: relative;
}
.dtx-usedbar::before { content: ""; position: absolute; inset: 0; width: var(--dtx-fill); background: var(--dtx-color); }

.dtx-detailrow td { background: #fbfdff; }
.dtx-detailcell { padding: 10px 12px; }
.dtx-detailwrap { border: 1px solid #eef2f5; border-radius: 10px; background: #fff; padding: 10px; }

.dtx-detailhdr { font-size: 13px; font-weight: 750; color: #2d5e8c; margin-bottom: 8px; }

.dtx-props { margin: 0; display: grid; grid-template-columns: 1fr; gap: 6px; }
.dtx-prop { display: grid; grid-template-columns: 180px 1fr; gap: 10px; align-items: baseline; }
.dtx-prop-k { margin: 0; color: #667; font-size: 12.5px; font-weight: 650; }
.dtx-prop-v { margin: 0; color: #111; font-size: 12.5px; font-variant-numeric: tabular-nums; }

.datatextures-table-hybrid .dtx-row[data-open="1"] { background: #fbfdff; }

.datatextures-chip {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.04em;
  border: 1px solid #e6e6e6;
  background: #f7fafc;
  color: #2d5e8c;
}
.datatextures-chip-stress {
  border-color: rgba(210, 35, 35, 0.35);
  background: rgba(210, 35, 35, 0.10);
  color: rgb(170, 20, 20);
  box-shadow: 0 0 0 1px rgba(210, 35, 35, 0.06) inset;
}
.datatextures-chip-stress-lite {
  border-color: rgba(210, 35, 35, 0.22);
  background: rgba(210, 35, 35, 0.06);
  color: rgb(170, 20, 20);
  opacity: 0.9;
}
.datatextures-summary-spacer { margin-left: auto; }
.datatextures-summary-title { display: inline-flex; align-items: center; }

.dtx-preview { width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.12); background: rgba(0,0,0,0.03); flex: 0 0 auto; }

.dtx-preview-large {
  width: 600px;
  height: auto;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.12);
  background: rgba(0,0,0,0.03);
  flex: 0 0 auto;
  display: block;
}

.dtx-detailpreviewrow { display: flex; align-items: center; gap: 12px; margin: 8px 0 10px 0; }
.dtx-detailpreviewhint { font-size: 12px; color: #667; line-height: 1.25; text-style: italic; margin-bottom: 12px; }

.dtx-detailsection { margin-top: 10px; }

.dtx-subhdr {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #2d5e8c;
  margin: 10px 0 6px 0;
  padding-top: 6px;
  border-top: 1px solid #eef2f5;
}
.dtx-prop { grid-template-columns: 200px 1fr; }

.dtx-jsoncell { width: 1%; white-space: nowrap; }

/* JSON floating overlay */
.dtx-json-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 9998;
}
.dtx-json-modal {
  position: fixed;
  top: 6vh;
  left: 50%;
  transform: translateX(-50%);
  width: min(1100px, 92vw);
  height: min(78vh, 900px);
  background: black;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.30);
  z-index: 200000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dtx-json-header {
font-size: 16px; font-weight: 750; color: #2d5e8c;
 font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #eef2f5;
  background: #fbfdff;
}
.dtx-json-title {
  font-weight: 750;
  color: #2d5e8c;
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px; font-weight: 750; color: #2d5e8c;
 font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.dtx-json-actions { margin-left: auto; display: inline-flex; gap: 8px; align-items: center; }
.dtx-json-pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  flex: 1 1 auto;
  font-size: 13px;
  line-height: 1.35;
  color: #eee;
  background: #111;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
    `;
    document.head.appendChild(style);
    (window as any).__datatextures_panel_style = true;
  }
}
