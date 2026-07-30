export function installViewerTestGlobals(HTMLElementImpl: unknown, ResizeObserverImpl: unknown): () => void {
  const g = globalThis as any;
  const previousHTMLElement = g.HTMLElement;
  const previousResizeObserver = g.ResizeObserver;
  const previousWindow = g.window;
  const installedWindow = typeof g.window === "undefined";

  g.HTMLElement = HTMLElementImpl;
  g.ResizeObserver = ResizeObserverImpl;
  if (installedWindow) {
    g.window = {
      addEventListener() {},
      removeEventListener() {}
    };
  }

  return () => {
    restoreGlobal(g, "HTMLElement", previousHTMLElement);
    restoreGlobal(g, "ResizeObserver", previousResizeObserver);
    if (installedWindow) {
      restoreGlobal(g, "window", previousWindow);
    }
  };
}

function restoreGlobal(target: any, key: string, value: unknown) {
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}
