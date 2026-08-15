import {NavigationRender, RealisticRender} from "../../../base/constants";
import {AdaptiveQuality} from "../AdaptiveQuality";

function createEvent<T extends (...args: any[]) => void>() {
  const listeners: T[] = [];
  return {
    subscribe: (listener: T) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    },
    dispatch: (...args: Parameters<T>) => {
      listeners.slice().forEach((listener) => listener(...args));
    },
    listenerCount: () => listeners.length
  };
}

function createView() {
  let renderMode = RealisticRender;
  const events = {
    onCameraViewMatrixUpdated: createEvent<any>(),
    onCameraProjMatrixUpdated: createEvent<any>(),
    onCameraProjectionTypeChanged: createEvent<any>(),
    onViewDestroyed: createEvent<any>()
  };
  const view = {
    id: "adaptive-test-view",
    viewer: {events},
    get renderMode() {
      return renderMode;
    },
    set renderMode(value: number) {
      renderMode = value;
    }
  };
  return {view, events};
}

describe("AdaptiveQuality", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("defers rest-mode restore and cancels it when camera motion resumes", () => {
    const {view, events} = createView();
    new AdaptiveQuality({view: view as any, restMs: 50});

    events.onCameraViewMatrixUpdated.dispatch(view);
    expect(view.renderMode).toBe(NavigationRender);

    jest.advanceTimersByTime(50);
    events.onCameraViewMatrixUpdated.dispatch(view);
    jest.runOnlyPendingTimers();

    expect(view.renderMode).toBe(NavigationRender);
  });

  it("restores rest mode after the idle restore callback runs", () => {
    const {view, events} = createView();
    new AdaptiveQuality({view: view as any, restMs: 50});

    events.onCameraViewMatrixUpdated.dispatch(view);
    jest.advanceTimersByTime(50);
    jest.runOnlyPendingTimers();

    expect(view.renderMode).toBe(RealisticRender);
  });
});
