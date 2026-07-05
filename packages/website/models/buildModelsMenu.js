export function buildModelsMenu(params) {

  const {
    modelsIndex,
    defaultViewerSrc = "./../examples/model_viewer/index.html",
    defaultModelId,
    defaultDataset
  } = params;

  const indexEl = document.getElementById("index");
  const pageTitleEl = document.getElementById("page-title");
  const viewerEl = document.getElementById("viewer");
  const viewSourceButtonEl = document.getElementById("viewSourceButton");
  const checkboxEl = document.getElementById("index_toggle");

  let currentSelection = null;
  let currentFilter = "";

  // ------------------------------------------------------------------------------------------------
  // Styles
  // ------------------------------------------------------------------------------------------------

  function ensureStyles() {
    if (document.getElementById("models-menu-styles")) return;

    const style = document.createElement("style");
    style.id = "models-menu-styles";
    style.textContent = `
      #index {
        height: 100%;
        overflow-y: auto;
        padding: 12px;
        background: #fff;
        box-sizing: border-box;
      }

      .models-menu-title {
        margin: 0 0 10px 0;
        font-size: 18px;
        font-weight: 700;
      }

      .models-menu-toolbar {
        margin-bottom: 12px;
      }

      .models-menu-filter {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        outline: none;
        font-size: 13px;
      }

      .models-menu-filter:focus {
        border-color: #93c5fd;
        box-shadow: 0 0 0 2px rgba(147, 197, 253, 0.3);
      }

      .models-menu-status {
        margin-top: 6px;
        font-size: 12px;
        color: #666;
      }

      .model-group {
        margin-bottom: 10px;
        border: 1px solid #e5e5e5;
        border-radius: 6px;
        background: #fff;
        overflow: hidden;
      }

      .model-header {
        display: block;
        width: 100%;
        text-align: left;
        border: 0;
        background: #f7f7f7;
        padding: 8px 10px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 700;
      }

      .model-header:hover {
        background: #efefef;
      }

      .model-details {
        padding: 8px 10px 10px 10px;
        border-top: 1px solid #e5e5e5;
      }

      .model-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .model-action-btn {
        border: 1px solid #cfcfcf;
        border-radius: 999px;
        background: #fafafa;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 13px;
        line-height: 1.3;
        color: #222;
        transition: background 0.15s, border-color 0.15s;
      }

      .model-action-btn:hover {
        background: #f0f0f0;
      }

      .model-action-btn.active {
        background: #dbeafe;
        border-color: #93c5fd;
        color: #1d4ed8;
      }

      .model-empty {
        font-size: 13px;
        color: #666;
        padding: 8px 0;
      }

      .model-attribution {
        margin-top: 8px;
        font-size: 12px;
        color: #666;
      }

      .model-attribution-link {
        color: #1d4ed8;
        text-decoration: none;
      }

      .model-attribution-link:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  // ------------------------------------------------------------------------------------------------

  function escapeHtml(v) {
    return String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeDatasetLabel(label) {
    return String(label)
      .split(",")
      .map(s => s.trim())
      .join(", ");
  }

  function makeViewerSrc(modelId, dataset) {
    const url = new URL(defaultViewerSrc, window.location.href);
    url.searchParams.set("modelId", modelId);
    url.searchParams.set("format", dataset);
    return url.toString();
  }

  function setSidebarOpen(isOpen) {
    if (checkboxEl) checkboxEl.checked = isOpen;
  }

  function updateViewer(modelId, dataset, keepSidebarOpen = false) {
    currentSelection = {modelId, dataset};

    viewerEl.src = makeViewerSrc(modelId, dataset);
    pageTitleEl.textContent = `${modelId} [${normalizeDatasetLabel(dataset)}]`;

    if (viewSourceButtonEl) {
      viewSourceButtonEl.title = `View model source for ${modelId}`;
      viewSourceButtonEl.onclick = () => {
        window.open(`https://github.com/xeokit/sdk/tree/master/models/${encodeURIComponent(modelId)}`, "_blank");
      };
    }

    highlightActiveSelection();
    window.location.hash = `${encodeURIComponent(modelId)}|${encodeURIComponent(dataset)}`;

    if (!keepSidebarOpen) {
      setSidebarOpen(false);
    }
  }

  function highlightActiveSelection() {
    indexEl.querySelectorAll(".model-action-btn").forEach(btn => {
      btn.classList.remove("active");
    });

    if (!currentSelection) return;

    const sel = `.model-action-btn[data-model-id="${CSS.escape(currentSelection.modelId)}"][data-dataset="${CSS.escape(currentSelection.dataset)}"]`;
    const el = indexEl.querySelector(sel);
    if (el) el.classList.add("active");
  }

  // ------------------------------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------------------------------

  function renderMenu() {
    const query = currentFilter.trim().toLowerCase();
    const modelIds = Object.keys(modelsIndex).sort();

    const filteredIds = modelIds.filter(modelId => {
      const ds = modelsIndex[modelId]?.dataset || [];
      if (ds.length === 0) return false;
      if (!query) return true;
      const haystack = [modelId, ...ds.map(normalizeDatasetLabel)].join(" ").toLowerCase();
      return haystack.includes(query);
    });

    const html = [];

    html.push(`<h1 class="models-menu-title">View a model with xeokit</h1>`);
    html.push(`
      <div class="models-menu-toolbar">
        <input id="models-filter-input" class="models-menu-filter" type="text"
               placeholder="Filter models..." value="${escapeHtml(currentFilter)}">
        <div class="models-menu-status">${filteredIds.length} of ${modelIds.length} models</div>
      </div>
    `);

    if (filteredIds.length === 0) {
      html.push(`<div class="model-empty">No matching models</div>`);
    } else {
      for (const modelId of filteredIds) {
        const dataset = modelsIndex[modelId]?.dataset || [];

        const buttons = dataset.map(ds => `
          <button
            class="model-action-btn"
            data-model-id="${escapeHtml(modelId)}"
            data-dataset="${escapeHtml(ds)}"
            type="button">
            ${escapeHtml(normalizeDatasetLabel(ds))}
          </button>
        `).join("");

        const attribution = modelsIndex[modelId]?.attribution;
        let attributionHtml = "";
        if (attribution?.source) {
          const label = escapeHtml(attribution.source);
          const source = attribution.url
            ? `<a class="model-attribution-link" href="${escapeHtml(attribution.url)}" target="_blank" rel="noopener">${label}</a>`
            : label;
          attributionHtml = `<div class="model-attribution">Source: ${source}</div>`;
        }

        html.push(`
          <div class="model-group">
            <button class="model-header" type="button">${escapeHtml(modelId)}</button>
            <div class="model-details">
              <div class="model-actions">${buttons}</div>
              ${attributionHtml}
            </div>
          </div>
        `);
      }
    }

    indexEl.innerHTML = html.join("");

    const filterInput = document.getElementById("models-filter-input");
    if (filterInput) {
      filterInput.addEventListener("input", e => {
        currentFilter = e.target.value;
        const cursorPos = filterInput.selectionStart;
        renderMenu();
        const newInput = document.getElementById("models-filter-input");
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }

    bindButtons();
    highlightActiveSelection();
  }

  function bindButtons() {
    indexEl.querySelectorAll(".model-action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const modelId = btn.getAttribute("data-model-id");
        const dataset = btn.getAttribute("data-dataset");
        if (modelId && dataset) {
          updateViewer(modelId, dataset);
        }
      });
    });
  }

  function getFirstSelection() {
    const ids = Object.keys(modelsIndex).sort();
    for (const id of ids) {
      const ds = modelsIndex[id]?.dataset || [];
      if (ds.length) return {modelId: id, dataset: ds[0]};
    }
    return null;
  }

  function parseHash() {
    const hash = window.location.hash.slice(1);
    const i = hash.indexOf("|");
    if (i === -1) return null;

    const modelId = decodeURIComponent(hash.slice(0, i));
    const dataset = decodeURIComponent(hash.slice(i + 1));

    if (!modelsIndex[modelId]) return null;
    if (!modelsIndex[modelId].dataset?.includes(dataset)) return null;

    return {modelId, dataset};
  }

  function init() {
    ensureStyles();

    window.addEventListener("hashchange", () => {
      const sel = parseHash();
      if (sel) updateViewer(sel.modelId, sel.dataset);
    });

    renderMenu();

    const sel = parseHash()
      || (defaultModelId && defaultDataset && {modelId: defaultModelId, dataset: defaultDataset})
      || getFirstSelection();

    if (sel) {
      updateViewer(sel.modelId, sel.dataset, true);
    } else {
      pageTitleEl.textContent = "No datasets available";
    }
  }

  init();

  return {
    updateViewer,
    getSelection: () => currentSelection
  };
}
