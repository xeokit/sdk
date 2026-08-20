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

function createViewProfiles() {
  const events = {
    onCameraViewMatrixUpdated: createEvent<any>(),
    onCameraProjMatrixUpdated: createEvent<any>(),
    onCameraProjectionTypeChanged: createEvent<any>(),
    onViewDestroyed: createEvent<any>()
  };
  const view = {
    id: "adaptive-test-view",
    viewer: {events}
  };
  const viewProfiles = {
    view,
    activeProfile: "realistic" as string | null,
    setActiveProfile: jest.fn((id: string | null) => {
      viewProfiles.activeProfile = id;
      return {ok: true, value: undefined};
    })
  };
  return {viewProfiles, view, events};
}

describe("AdaptiveQuality", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("defers rest-profile restore and cancels it when camera motion resumes", () => {
    const {viewProfiles, view, events} = createViewProfiles();
    new AdaptiveQuality({viewProfiles: viewProfiles as any, restMs: 50});

    events.onCameraViewMatrixUpdated.dispatch(view);
    expect(viewProfiles.activeProfile).toBe("fast");

    jest.advanceTimersByTime(50);
    events.onCameraViewMatrixUpdated.dispatch(view);
    jest.runOnlyPendingTimers();

    expect(viewProfiles.activeProfile).toBe("fast");
  });

  it("restores rest profile after the idle restore callback runs", () => {
    const {viewProfiles, view, events} = createViewProfiles();
    new AdaptiveQuality({viewProfiles: viewProfiles as any, restMs: 50});

    events.onCameraViewMatrixUpdated.dispatch(view);
    jest.advanceTimersByTime(50);
    jest.runOnlyPendingTimers();

    expect(viewProfiles.activeProfile).toBe("realistic");
  });
});
