/**
 * Shared overlay container for floating debug panels.
 * Panels mount into this container as tiles and will flow-wrap automatically.
 */
export class FloatingPanelFlowHost {

  static #HOST_ID = "__floating_panel_flow_host__";
  static #STYLE_ID = "__floating_panel_flow_style__";

  static getOrCreate(opts: {
    corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
    zIndex?: number;
    maxWidth?: number;        // max width for the whole overlay area
    tileMinWidth?: number;    // per-panel min width
    gapPx?: number;
    marginTopPx?: number;
    marginBottomPx?: number;
    marginLeftPx?: number;
    marginRightPx?: number;
    maxHeightVh?: number;
  } = {}) {
    this.#ensureStyle(opts);

    const {
      corner = "top-right",
      zIndex = 2147483647,
      maxWidth = 2000,
      gapPx = 12,
      marginTopPx = 12,
      marginBottomPx = 12,
      marginLeftPx = 12,
      marginRightPx = 12,
      maxHeightVh = 90,
    } = opts;

    let host = document.getElementById(this.#HOST_ID) as HTMLDivElement | null;
    if (!host) {
      host = document.createElement("div");
      host.id = this.#HOST_ID;
      host.className = "fpfh-host";

      host.style.backgroundColor = "rgba(0, 0, 0, 0)";

      // Lay above everything
      host.style.position = "absolute";
      host.style.zIndex = String(zIndex);

      host.style.paddingRight="10px";

      // Flow layout
      host.style.display = "flex";
      host.style.justifyContent = "flex-start"; // Align panels to the right
      host.style.flexWrap = "wrap";
      host.style.gap = `${gapPx}px`;
      host.style.alignItems = "flex-start";

      // Allow clicks to pass through when not on a panel (panels will re-enable pointer events)
      host.style.pointerEvents = "all";

      // Bounding box
      host.style.maxHeight = `${maxHeightVh}vh`;
      host.style.overflow = "auto";
      host.style.width = `min(${maxWidth}px, calc(100vw - ${marginLeftPx + marginRightPx + 10}px))`;

      document.body.appendChild(host);
    }

    // Place in chosen corner
    host.style.top = "";
    host.style.right = "";
    host.style.bottom = "";
    host.style.left = "";
    switch (corner) {
      case "top-left":
        host.style.top = `${marginTopPx}px`;
        host.style.left = `${marginLeftPx}px`;
        break;
      case "bottom-right":
        host.style.bottom = `${marginBottomPx}px`;
        host.style.right = `${marginRightPx}px`;
        break;
      case "bottom-left":
        host.style.bottom = `${marginBottomPx}px`;
        host.style.left = `${marginLeftPx}px`;
        break;
      case "top-right":
      default:
        host.style.top = `${marginTopPx}px`;
        host.style.right = `${marginRightPx}px`;
        break;
    }

    return host;
  }

  /**
   * Wraps a panel root in a "tile" that participates in flow layout.
   * The tile enables pointer events (host disables them).
   */
  static mountTile(panelRoot: HTMLElement, opts: { tileMinWidth?: number; tileMaxWidth?: number } = {}) {
    const { tileMinWidth = 420, tileMaxWidth = 560 } = opts;

    const tile = document.createElement("div");
    tile.className = "fpfh-tile";
    tile.style.minWidth = `${tileMinWidth}px`;
    tile.style.maxWidth = `${tileMaxWidth}px`;
    tile.style.flex = `1 1 ${tileMinWidth}px`; // allow wrap + growth
    tile.style.pointerEvents = "auto";         // re-enable interaction for the tile

    tile.appendChild(panelRoot);
    return tile;
  }

  static #ensureStyle(opts: any) {
    if (document.getElementById(this.#STYLE_ID)) return;

    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = `
      .fpfh-host { box-sizing: border-box; }
      .fpfh-tile { box-sizing: border-box; }
    `;
    document.head.appendChild(s);
  }
}
