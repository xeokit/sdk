export function signalExampleLoaded() {
  document.body.classList.add("xeokit-loading-spinner-ready");
  if (document.getElementById("ExampleLoaded")) {
    return;
  }
  const marker = document.createElement("div");
  marker.id = "ExampleLoaded";
  marker.hidden = true;
  document.body.appendChild(marker);
}

export function signalExampleLoadedOnNextRender(renderer, view = null) {
  let done = false;
  let unsubscribe = null;

  const finish = () => {
    if (done) {
      return;
    }
    done = true;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    signalExampleLoaded();
  };

  const onViewRendered = renderer?.events?.onViewRendered;
  if (onViewRendered && typeof onViewRendered.subscribe === "function") {
    unsubscribe = onViewRendered.subscribe((_renderer, renderedView) => {
      if (view && renderedView && renderedView !== view) {
        return;
      }
      finish();
    });
  }

  requestAnimationFrame(() => requestAnimationFrame(finish));
}
