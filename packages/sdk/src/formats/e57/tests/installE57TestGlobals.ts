type RestoreGlobals = () => void;

export async function installE57TestGlobals(): Promise<RestoreGlobals> {
  const g = globalThis as any;
  const previousDocument = g.document;
  const previousDOMParser = g.DOMParser;
  const previousTextEncoder = g.TextEncoder;
  const previousTextDecoder = g.TextDecoder;
  let dom: { window: { document: Document; DOMParser: typeof DOMParser; close: () => void } } | null = null;
  const changedKeys: string[] = [];

  if (typeof g.DOMParser === "undefined") {
    const {JSDOM} = await import("jsdom");
    dom = new JSDOM("<!doctype html><html><body></body></html>");
    g.document = dom.window.document;
    g.DOMParser = dom.window.DOMParser;
    changedKeys.push("document", "DOMParser");
  }

  if (typeof g.TextEncoder === "undefined" || typeof g.TextDecoder === "undefined") {
    const util = await import("util");
    if (typeof g.TextEncoder === "undefined") {
      g.TextEncoder = util.TextEncoder;
      changedKeys.push("TextEncoder");
    }
    if (typeof g.TextDecoder === "undefined") {
      g.TextDecoder = util.TextDecoder;
      changedKeys.push("TextDecoder");
    }
  }

  return () => {
    for (const key of changedKeys) {
      const previousValue = key === "document"
        ? previousDocument
        : key === "DOMParser"
          ? previousDOMParser
          : key === "TextEncoder"
            ? previousTextEncoder
            : previousTextDecoder;
      restoreGlobal(g, key, previousValue);
    }
    dom?.window.close();
  };
}

function restoreGlobal(target: any, key: string, value: unknown) {
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}
