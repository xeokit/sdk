function buildExamplesIndex(params) {
  const sectionDivs = {};
  const divs = {};
  const fileDescriptions = {};
  let selected = null;
  let index = 1;
  var indexStr;
  const pages = params.index ? params.index || {} : {};
  const list = document.getElementById("index");
  const iframe = document.getElementById("viewer");
  const iframeOverlay = document.getElementById("viewer-overlay");
  const parentSearchParams = new URLSearchParams(window.location.search);
  const forwardedExampleSearchParams = new URLSearchParams();
  ["renderer", "backend"].forEach((name) => {
    const value = parentSearchParams.get(name);
    if (value !== null) {
      forwardedExampleSearchParams.set(name, value);
    }
  });
  const container = document.createElement("div");
  list.appendChild(container);
  const viewSourceButton = document.getElementById("viewSourceButton");
  viewSourceButton.addEventListener("click", function(event) {
    window.open("https://github.com/xeokit/sdk/blob/develop/packages/website/examples/" + selected);
  }, false);
  const indexToggle = document.getElementById("index_toggle");
  const pageTitle = document.getElementById("page-title");
  iframeOverlay.addEventListener("click", function(event) {
    indexToggle.checked = false;
  }, false);
  let div = document.createElement("h2");
  div.textContent = "Categories";
  container.appendChild(div);
  container.appendChild(document.createElement("hr"));
  const categoryLookup = {};
  const pageIds = Object.keys(pages);
  const pageList = Object.values(pages);
  const categories = {};
  const categoriesList = [];
  for (let pageId in pages) {
    const page = pages[pageId];
    page.id = pageId;
    page._components = [];
    const separatorIndex = pageId.includes("/") ? pageId.indexOf("/") : pageId.indexOf("_");
    const categoryId = separatorIndex >= 0 ? pageId.substring(0, separatorIndex) : pageId;
    page.category = categoryId;
    let category = categories[categoryId];
    if (!category) {
      category = {
        categoryId,
        pages: []
      };
      categories[categoryId] = category;
      categoriesList.push(category);
    }
    category.pages.push(page);
  }
  for (let i = 0, len = categoriesList.length; i < len; i++) {
    const category = categoriesList[i];
    if (category.pages.length === 0) {
      continue;
    }
    const categoryId = category.categoryId;
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "link";
    indexStr = "" + index++ + ".";
    for (let i2 = indexStr.length, len2 = 5; i2 < len2; i2++) {
      indexStr += ".";
    }
    sectionDiv.textContent = indexStr + categoryId;
    sectionDiv.addEventListener("click", /* @__PURE__ */ function() {
      const _sectionId = categoryId;
      return function() {
        sectionDivs[_sectionId].scrollIntoView();
      };
    }());
    container.appendChild(sectionDiv);
  }
  container.appendChild(document.createElement("hr"));
  let _index = 1;
  let clickedFile = null;
  for (let i = 0, len = categoriesList.length; i < len; i++) {
    const category = categoriesList[i];
    if (category.pages.length === 0) {
      continue;
    }
    const categoryId = category.categoryId;
    const categoryPages = category.pages;
    const sectionDiv = document.createElement("h2");
    sectionDiv.textContent = _index++ + ". " + categoryId;
    container.appendChild(sectionDiv);
    sectionDivs[categoryId] = sectionDiv;
    container.appendChild(document.createElement("hr"));
    for (let i2 = 0; i2 < categoryPages.length; i2++) {
      const page = categoryPages[i2];
      const pageId = page.id;
      const iframePage = pageId;
      const fileNameDiv = document.createElement("div");
      fileNameDiv.className = "link";
      fileNameDiv.textContent = pageId.replace(/\//g, " / ").replace(/_/g, " / ");
      fileNameDiv.addEventListener("click", /* @__PURE__ */ function() {
        const _file = iframePage;
        return function() {
          clickedFile = _file;
          window.location.hash = "#" + _file;
          iframe.src = "";
        };
      }());
      container.appendChild(fileNameDiv);
      divs[iframePage] = fileNameDiv;
      fileDescriptions[iframePage] = page.description;
    }
  }
  const paddingDiv = document.createElement("div");
  paddingDiv.style["height"] = "50px";
  container.appendChild(paddingDiv);
  function expandCamel(str) {
    return str.replace(/([A-Z])/g, function($1) {
      return " " + $1.toLowerCase();
    });
  }
  if (window.location.hash !== "") {
    load(resolvePageId(window.location.hash.substring(1)));
  } else {
    indexToggle.checked = true;
  }
  var hash = window.location.hash;
  window.setInterval(function() {
    if (window.location.hash !== hash || iframe.src === "") {
      load(resolvePageId(window.location.hash.substring(1)));
      hash = window.location.hash;
      indexToggle.checked = false;
    }
  }, 70);
  function scrollIntoView(div2) {
    document.getElementById("index").scrollTop = documentOffsetTop(div2) - window.innerHeight / 6;
  }
  function documentOffsetTop(div2) {
    return div2.offsetTop + (div2.offsetParent ? documentOffsetTop(div2.offsetParent) : 0);
  }
  function load(file) {
    if (!divs[file]) {
      file = pageIds[0];
    }
    if (!file || !divs[file]) {
      return;
    }
    if (selected !== null && divs[selected])
      divs[selected].className = "link";
    divs[file].className = "link selected";
    window.location.hash = file;
    const forwardedSearch = forwardedExampleSearchParams.toString();
    iframe.src = file + "/index.html" + (forwardedSearch ? "?" + forwardedSearch : "");
    iframe.focus();
    viewSourceButton.style.display = "";
    selected = file;
    if (clickedFile !== file) {
      scrollIntoView(divs[file]);
    }
    clickedFile = null;
  }
  function resolvePageId(file) {
    return divs[file] ? file : pageIds[0];
  }
  function isString(value) {
    return typeof value === "string" || value instanceof String;
  }
}
export {
  buildExamplesIndex
};
