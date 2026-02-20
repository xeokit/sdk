import { SDKTaskRunner } from "../core/SDKTaskRunner";
import { SDKTask } from "../core/SDKTask";


function taskPanelIconDataUri(): string {
  // 60x60 SVG: bold green play button (circle with right-pointing triangle), no text
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <!-- Shadow -->
  <ellipse cx="30" cy="48" rx="16" ry="5" fill="#222" opacity="0.13"/>
  <!-- Green play button -->
  <circle cx="30" cy="30" r="18" fill="#27ae60" stroke="#219150" stroke-width="2"/>
  <!-- Play triangle -->
  <polygon points="26,21 26,39 41,30" fill="#fff" stroke="#fff" stroke-width="1"/>
  <!-- Frame border -->
  <rect x="4" y="4" width="52" height="52" rx="12" fill="none" stroke="#e6e6e6" stroke-width="1.5"/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class TaskPanel {
  static #TILE_ID = "__taskpanel_tile__";
  static #STYLE_ID = "__taskpanel_style__";

  static show(flowHost: HTMLDivElement, runner: SDKTaskRunner, opts: any = {}) {
    this.#ensureGlobalStyle();
    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;
    if (!tile) {
      tile = document.createElement("div");
      tile.id = this.#TILE_ID;
      tile.className = "taskpanel-root";
      flowHost.appendChild(tile);
    }
    tile.innerHTML = "";
    tile.appendChild(this.render(runner, opts));
  }

  static render(runner: SDKTaskRunner, opts: any = {}) {
    const root = el("div", { className: "taskpanel-root" });

    // Header
    root.appendChild(this.renderHeader(runner, opts));

    // Body
    root.appendChild(this.renderBody(runner, opts));

    return root;
  }

  static renderHeader(runner: SDKTaskRunner, opts: any = {}) {
   return el("div", { className: "taskpanel-header" }, [
      el("img", {
        className: "shins-title-icon",
        width: 60,
        height: 60,
        alt: "Shader icon",
        src: taskPanelIconDataUri(),
        draggable: false,
      }),
      el("div", { className: "taskpanel-title-col" }, [
        el("div", { className: "taskpanel-h1", textContent: "Tasks" }),
        el("div", { className: "taskpanel-subtitle", textContent: "All SDKTask instances currently running in the SDKTaskRunner. These are frozen while this inspector is open." }),
      ])
    ]);
  }

  static renderBody(runner: SDKTaskRunner, opts: any = {}) {
    const body = el("div", { className: "taskpanel-body" });

    // Gather all tasks by stage
    const tasks: Array<{ stage: number, task: SDKTask }> = [];
    for (let stage = 0; stage <= 5; stage++) {
      const set = (runner as any).tasksByStage?.get(stage);
      if (set && set.size) {
        for (const task of set) {
          tasks.push({ stage, task });
        }
      }
    }

    // Table
    const table = el("table", { className: "taskpanel-table" });
    const thead = el("thead", {}, [
      el("tr", {}, [
        el("th", { textContent: "Stage" }),
        el("th", { textContent: "Task Name" }),
        el("th", { textContent: "Status" }),
        // el("th", { textContent: "" }), // Optionally: Remove button
      ])
    ]);
    table.appendChild(thead);

    const tbody = el("tbody", {});
    if (tasks.length === 0) {
      tbody.appendChild(
        el("tr", {}, [
          el("td", { className: "taskpanel-empty", colSpan: 3, textContent: "No tasks." })
        ])
      );
    } else {
      for (const { stage, task } of tasks) {
        tbody.appendChild(
          el("tr", {}, [
            el("td", { textContent: String(stage) }),
            el("td", { textContent: task.name || task.constructor?.name || "SDKTask" }),
            el("td", { textContent: task.destroyed ? "destroyed" : (task.repeating ? "repeating" : "scheduled") }),
            // Optionally, add a remove button:
            // el("td", {}, [
            //   el("button", {
            //     className: "taskpanel-btn taskpanel-btn--sub",
            //     type: "button",
            //     onclick: () => { task.destroyed = true; this.show(flowHost, runner, opts); }
            //   }, ["Remove"])
            // ])
          ])
        );
      }
    }
    table.appendChild(tbody);
    body.appendChild(table);
    return body;
  }

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = this.#STYLE_ID;
    style.textContent = `
.taskpanel-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }
.taskpanel-header {
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
.taskpanel-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}
.taskpanel-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}
.taskpanel-h1 { padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650; }
.taskpanel-subtitle { font-size: 12px; color: #444; line-height: 1.35; }
.taskpanel-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.taskpanel-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.taskpanel-btn:hover { background: #fafafa; }
.taskpanel-btn--sub { padding: 5px 8px; border-radius: 10px; font-size: 11px; }
.taskpanel-body { margin-top: 12px; }
.taskpanel-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border: 1px solid #e6e6e6; border-radius: 12px; overflow: hidden; }
.taskpanel-table th { text-align: left; color: #666; font-weight: 650; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
.taskpanel-table td { padding: 8px 10px; border-top: 1px solid #f7f7f7; vertical-align: top; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.taskpanel-empty { color: #888; font-size: 13px; text-align: center; }
    `;
    document.head.appendChild(style);
  }
}

// Small DOM util
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, any> | null,
  children?: (HTMLElement | string)[]
): HTMLElement {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    if (k === "className") e.className = props[k];
    else if (k === "textContent") e.textContent = props[k];
    else if (k === "htmlFor") (e as any).htmlFor = props[k];
    else if (k.startsWith("on") && typeof props[k] === "function") e.addEventListener(k.slice(2).toLowerCase(), props[k]);
    else e.setAttribute(k, props[k]);
  }
  if (children) for (const c of children) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return e;
}
