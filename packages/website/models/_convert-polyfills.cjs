// Headless polyfills for the xeoconvert CLI, injected via `node --require`.
// Some loaders (3DXML, E57) parse XML with the browser's DOMParser; under Node
// they need a global DOMParser. jsdom provides a spec-compliant one.
try {
  const {JSDOM} = require("jsdom");
  if (typeof globalThis.DOMParser === "undefined") {
    globalThis.DOMParser = new JSDOM("").window.DOMParser;
  }
} catch (e) {
  // jsdom not resolvable — leave DOMParser absent; affected loaders report it.
}
