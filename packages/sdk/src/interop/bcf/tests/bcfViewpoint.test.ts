import {PerspectiveProjectionType} from "../../../base/constants";
import {SDKErrorType} from "../../../base/core";
import {loadBCFViewpoint} from "../loadBCFViewpoint";
import {saveBCFViewpoint} from "../saveBCFViewpoint";

type StubViewObject = {
  id: string;
  originalSystemId: string;
  layer?: { id: string };
  visible: boolean;
  selected: boolean;
  highlighted: boolean;
  xrayed: boolean;
  opacity: number;
  colorize?: number[];
};

function makeViewObject(id: string, originalSystemId = id, layerId?: string): StubViewObject {
  return {
    id,
    originalSystemId,
    layer: layerId ? {id: layerId} : undefined,
    visible: true,
    selected: false,
    highlighted: false,
    xrayed: false,
    opacity: 1,
  };
}

function makeSaveView(overrides: Record<string, any> = {}) {
  const wall = makeViewObject("wall-runtime", "ifc-wall", "foreground");
  wall.colorize = [1, 0, 0];
  wall.xrayed = true;
  const door = makeViewObject("door-runtime", "ifc-door", "background");
  door.colorize = [0, 0, 1];

  const objects: Record<string, StubViewObject> = {
    [wall.id]: wall,
    [door.id]: door,
  };

  return {
    destroyed: false,
    viewer: {scene: {coordinateSystem: {yUp: false}}},
    camera: {
      eye: [0, 0, 0],
      look: [0, 0, 10],
      up: [0, 1, 0],
      projectionType: PerspectiveProjectionType,
      perspectiveProjection: {fov: 60},
      orthoProjection: {scale: 25},
    },
    sectionPlanes: {
      active: {active: true, pos: [1, 2, 3], dir: [0, 0, -1]},
      inactive: {active: false, pos: [9, 9, 9], dir: [1, 0, 0]},
    },
    objects,
    objectIds: Object.keys(objects),
    visibleObjects: {
      [wall.id]: true,
      [door.id]: false,
    },
    visibleObjectIds: [wall.id],
    selectedObjectIds: [wall.id, door.id],
    xrayedObjectIds: [wall.id, door.id],
    opacityObjectIds: [],
    colorizedObjectIds: [wall.id, door.id],
    xrayMaterial: {fillAlpha: 0.25, edgeAlpha: 0},
    ...overrides,
  } as any;
}

function makeLoadView() {
  const wall = makeViewObject("wall-runtime", "ifc-wall", "foreground");
  const door = makeViewObject("door-runtime", "ifc-door", "foreground");
  const opening = makeViewObject("opening-runtime", "ifc-opening", "foreground");
  const objects: Record<string, StubViewObject> = {
    [wall.id]: wall,
    [door.id]: door,
    [opening.id]: opening,
  };
  const layer = {
    id: "foreground",
    objectIds: Object.keys(objects),
    selectedObjectIds: [door.id],
    highlightedObjectIds: [wall.id],
    xrayedObjectIds: [opening.id],
    setObjectsVisible: (ids: string[], visible: boolean) => {
      for (const id of ids) {
        objects[id].visible = visible;
      }
    },
    setObjectsSelected: (ids: string[], selected: boolean) => {
      for (const id of ids) {
        objects[id].selected = selected;
      }
    },
    setObjectsHighlighted: (ids: string[], highlighted: boolean) => {
      for (const id of ids) {
        objects[id].highlighted = highlighted;
      }
    },
    setObjectsXRayed: (ids: string[], xrayed: boolean) => {
      for (const id of ids) {
        objects[id].xrayed = xrayed;
      }
    },
  };
  const sectionPlanes: any[] = [];

  return {
    view: {
      viewer: {scene: {coordinateSystem: {yUp: false}}},
      camera: {
        eye: [0, 0, 0],
        look: [0, 0, 0],
        up: [0, 1, 0],
        projectionType: PerspectiveProjectionType,
        perspectiveProjection: {fov: 45},
        orthoProjection: {scale: 10},
      },
      objects,
      layers: {[layer.id]: layer},
      xrayedObjectIds: [opening.id],
      clearSectionPlanes: jest.fn(() => {
        sectionPlanes.length = 0;
      }),
      createSectionPlane: jest.fn((params: any) => {
        sectionPlanes.push({
          pos: Array.from(params.pos),
          dir: Array.from(params.dir),
        });
      }),
      setObjectsXRayed: (ids: string[], xrayed: boolean) => {
        for (const id of ids) {
          objects[id].xrayed = xrayed;
        }
      },
    } as any,
    data: {
      objects: {},
      objectsByType: {
        IfcSpace: {},
        IfcOpeningElement: {},
      },
    } as any,
    objects,
    sectionPlanes,
  };
}

describe("BCF viewpoint interop", () => {

  it("saves camera, active clipping planes, filtered component states, and snapshot data", () => {
    const view = makeSaveView();
    const renderer = {
      getSnapshot: jest.fn(() => ({
        ok: true,
        value: "data:image/png;base64,encoded-png",
      })),
    };

    const result = saveBCFViewpoint({
      view,
      renderer,
      defaultInvisible: true,
      originatingSystem: "xeokit-test",
      includeViewLayerIds: ["foreground"],
      spacesVisible: true,
      openings_translucent: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.value.perspective_camera).toEqual({
      camera_view_point: {x: 0, y: 0, z: 0},
      camera_direction: {x: 0, y: 0, z: 1},
      camera_up_vector: {x: 0, y: 1, z: 0},
      field_of_view: 60,
    });
    expect(result.value.clipping_planes).toEqual([
      {
        location: {x: 1, y: 2, z: 3},
        direction: {x: 0, y: 0, z: -1},
      },
    ]);
    expect(result.value.components?.visibility?.default_visibility).toBe(false);
    expect(result.value.components?.visibility?.exceptions).toEqual([
      {
        ifc_guid: "ifc-wall",
        originating_system: "xeokit-test",
        authoring_tool_id: "wall-runtime",
      },
    ]);
    expect(result.value.components?.selection).toEqual([
      {
        ifc_guid: "ifc-wall",
        originating_system: "xeokit-test",
        authoring_tool_id: "wall-runtime",
      },
    ]);
    expect(result.value.components?.translucency).toEqual([
      {
        ifc_guid: "ifc-wall",
        originating_system: "xeokit-test",
        authoring_tool_id: "wall-runtime",
      },
    ]);
    expect(result.value.components?.coloring).toEqual([
      {
        color: "40ff0000",
        components: [
          {
            ifc_guid: "ifc-wall",
            originating_system: "xeokit-test",
            authoring_tool_id: "wall-runtime",
          },
        ],
      },
    ]);
    expect(result.value.components?.visibility?.view_setup_hints).toMatchObject({
      spaces_visible: true,
      openings_translucent: true,
    });
    expect(result.value.snapshot).toEqual({
      snapshot_type: "png",
      snapshot_data: "encoded-png",
    });
    expect(renderer.getSnapshot).toHaveBeenCalledWith(view);
  });

  it("returns an invalid-operation result when saving a destroyed view", () => {
    const result = saveBCFViewpoint({
      view: makeSaveView({destroyed: true}),
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.type).toBe(SDKErrorType.InvalidOperation);
      expect(result.error).toContain("View has been destroyed");
    }
  });

  it("loads clipping planes, component state, color, opacity, and perspective camera", () => {
    const {view, data, objects, sectionPlanes} = makeLoadView();

    loadBCFViewpoint({
      view,
      data,
      originatingSystem: "xeokit-test",
      bcfViewpoint: {
        perspective_camera: {
          camera_view_point: {x: 1, y: 2, z: 3},
          camera_direction: {x: 0, y: 0, z: -1},
          camera_up_vector: {x: 0, y: 1, z: 0},
          field_of_view: 75,
        },
        clipping_planes: [
          {
            location: {x: 4, y: 5, z: 6},
            direction: {x: 0, y: 1, z: 0},
            up: {x: 0, y: 0, z: 1},
            height: 1,
          },
        ],
        components: {
          visibility: {
            default_visibility: false,
            exceptions: [
              {
                ifc_guid: "ifc-wall",
                originating_system: "xeokit-test",
                authoring_tool_id: "wall-runtime",
              },
            ],
            view_setup_hints: {
              spaces_visible: true,
              space_boundaries_visible: true,
              openings_visible: true,
              spaces_translucent: false,
              space_boundaries_translucent: false,
              openings_translucent: false,
            },
          },
          selection: [
            {
              ifc_guid: "ifc-door",
              originating_system: "xeokit-test",
              authoring_tool_id: "door-runtime",
            },
          ],
          translucency: [
            {
              ifc_guid: "ifc-opening",
              originating_system: "xeokit-test",
              authoring_tool_id: "opening-runtime",
            },
          ],
          coloring: [
            {
              color: "80ff0000",
              components: [
                {
                  ifc_guid: "ifc-wall",
                  originating_system: "xeokit-test",
                  authoring_tool_id: "wall-runtime",
                },
              ],
            },
          ],
        },
      },
    });

    expect(view.clearSectionPlanes).toHaveBeenCalledTimes(1);
    expect(view.createSectionPlane).toHaveBeenCalledTimes(1);
    expect(sectionPlanes).toEqual([
      {
        pos: expect.arrayContaining([4, 5, 6]),
        dir: expect.arrayContaining([0, 1, 0]),
      },
    ]);

    expect(objects["wall-runtime"].visible).toBe(true);
    expect(objects["door-runtime"].visible).toBe(false);
    expect(objects["door-runtime"].selected).toBe(true);
    expect(objects["opening-runtime"].xrayed).toBe(true);
    expect(objects["wall-runtime"].colorize).toEqual([255 / 256, 0, 0]);
    expect(objects["wall-runtime"].opacity).toBeCloseTo(0.5, 6);

    expect(view.camera.projectionType).toBe(PerspectiveProjectionType);
    expect(view.camera.perspectiveProjection.fov).toBe(75);
    expect(Array.from(view.camera.eye)).toEqual([1, 2, 3]);
    expect(Array.from(view.camera.look)).toEqual([1, 2, 2]);
    expect(Array.from(view.camera.up)).toEqual([0, 1, 0]);
  });
});
