/**
 * @jest-environment jsdom
 */

import {SDKErrorType} from "../../../base/core";

jest.mock("../internal/ViewManager", () => ({ViewManager: jest.fn()}));
jest.mock("../internal/webGL", () => ({getWebGLExtension: jest.fn()}));
jest.mock("../internal/inspectors", () => ({
  ShaderInspector: class {},
  RenderInspector: class {},
}));

import {WebGLRenderer} from "../WebGLRenderer";
import {ViewManager} from "../internal/ViewManager";

function createSubscribable() {
  const unsubs: jest.Mock[] = [];
  const event = {
    subscribe: jest.fn(() => {
      const unsub = jest.fn();
      unsubs.push(unsub);
      return unsub;
    }),
  };
  return {event, unsubs};
}

function createViewer(hasScene: boolean) {
  const onSceneAttached = createSubscribable();
  const onSceneDetached = createSubscribable();
  const onViewerDestroyed = createSubscribable();

  return {
    viewer: {
      scene: hasScene ? {} : null,
      events: {
        onSceneAttached: onSceneAttached.event,
        onSceneDetached: onSceneDetached.event,
        onViewerDestroyed: onViewerDestroyed.event,
      },
    },
    subscriptions: [onSceneAttached, onSceneDetached, onViewerDestroyed],
  };
}

describe("WebGLRenderer.attachViewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("rolls back viewer state when ViewManager init fails during initial attach", () => {
    const destroy = jest.fn();
    (ViewManager as unknown as jest.Mock).mockImplementationOnce(() => ({
      init: jest.fn(() => ({
        ok: false,
        type: SDKErrorType.NotSupported,
        error: "WebGL2 unavailable",
      })),
      destroy,
    }));

    const renderer = new WebGLRenderer() as any;
    renderer.logging = false;
    const failed = createViewer(true);

    const result = renderer.attachViewer(failed.viewer as any);

    expect(result.ok).toBe(false);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(renderer.viewer).toBeNull();
    expect(renderer._viewerSubs).toEqual([]);
    for (const sub of failed.subscriptions) {
      expect(sub.event.subscribe).toHaveBeenCalledTimes(1);
    }
    for (const unsub of failed.subscriptions.flatMap((sub) => sub.unsubs)) {
      expect(unsub).toHaveBeenCalledTimes(1);
    }

    const retry = createViewer(false);
    expect(renderer.attachViewer(retry.viewer as any).ok).toBe(true);
    expect(renderer.viewer).toBe(retry.viewer);

    renderer.detachViewer();
  });

  test("removes WebGL context listeners when destroying the view manager", () => {
    const canvas = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    const viewManager = {
      getWebGLCanvasElement: jest.fn(() => canvas),
      webglContextLost: jest.fn(),
      webglContextRestored: jest.fn(() => ({ok: true, value: undefined})),
      viewUpdated: jest.fn(() => ({ok: true, value: undefined})),
      destroy: jest.fn(),
    };
    const renderer = new WebGLRenderer() as any;
    renderer._viewManager = viewManager;
    renderer._viewManagerSubs = [];

    renderer._installWebGLContextListeners(viewManager);

    const lostHandler = canvas.addEventListener.mock.calls[0][1];
    const restoredHandler = canvas.addEventListener.mock.calls[1][1];

    expect(canvas.addEventListener).toHaveBeenCalledWith("webglcontextlost", lostHandler);
    expect(canvas.addEventListener).toHaveBeenCalledWith("webglcontextrestored", restoredHandler);

    renderer._destroyViewManager();

    expect(canvas.removeEventListener).toHaveBeenCalledWith("webglcontextlost", lostHandler);
    expect(canvas.removeEventListener).toHaveBeenCalledWith("webglcontextrestored", restoredHandler);
    expect(viewManager.destroy).toHaveBeenCalledTimes(1);

    lostHandler({preventDefault: jest.fn()});
    restoredHandler({});

    expect(viewManager.webglContextLost).not.toHaveBeenCalled();
    expect(viewManager.webglContextRestored).not.toHaveBeenCalled();
  });

  test("polls for context restoration when the restored event is not delivered", () => {
    jest.useFakeTimers();
    let contextLost = true;
    const gl = {
      isContextLost: jest.fn(() => contextLost),
      getExtension: jest.fn(() => ({restoreContext: jest.fn()})),
    };
    const canvas = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getContext: jest.fn(() => gl),
    };
    const view = {needsRender: jest.fn()};
    const viewManager = {
      getWebGLCanvasElement: jest.fn(() => canvas),
      webglContextLost: jest.fn(),
      webglContextRestored: jest.fn(() => ({ok: true, value: undefined})),
      viewUpdated: jest.fn(() => ({ok: true, value: undefined})),
    };
    const renderer = new WebGLRenderer() as any;
    renderer._viewManager = viewManager;
    renderer._viewer = {viewList: [view]};

    renderer._installWebGLContextListeners(viewManager);
    const lostHandler = canvas.addEventListener.mock.calls[0][1];

    lostHandler({preventDefault: jest.fn()});
    lostHandler({preventDefault: jest.fn()});

    expect(viewManager.webglContextLost).toHaveBeenCalledTimes(1);
    expect(viewManager.webglContextRestored).not.toHaveBeenCalled();

    contextLost = false;
    jest.advanceTimersByTime(125);

    expect(viewManager.webglContextRestored).toHaveBeenCalledTimes(1);
    expect(view.needsRender).toHaveBeenCalledTimes(1);
    expect(viewManager.viewUpdated).toHaveBeenCalledWith(view);
    expect(renderer._webglContextLost).toBe(false);
  });
});
