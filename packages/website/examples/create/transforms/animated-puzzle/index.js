// Import the xeokit SDK bundle used by this example.
// It provides the helper, loader, and rendering APIs used in this sample.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
// Create the demo helper.
// It initializes the scene, data, viewer, and renderer context for this demo.
const studio = new xeokit.studio.Studio({});

// Big coordinate offset (keeps numbers similar to other demos)
const OFFSET = 100000;

studio.init().then(() => {
  const {  scene } = studio;

  // ---------------------------------------------------------------------------
  // Camera: frame the sliding puzzle
  // ---------------------------------------------------------------------------

  studio.viewManager.createView({
    camera: {
      eye: [OFFSET + 0, 18, 24],
      look: [OFFSET + 0, 0, 0],
      up: [0, 0, 1]
    }
  });

  // ---------------------------------------------------------------------------
  // SceneModel: holds geometry, meshes, transforms, objects
  // ---------------------------------------------------------------------------

  const sceneModelResult = scene.createModel({ id: "slidingPuzzleModel" });
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }
  const sceneModel = sceneModelResult.value;

  // ---------------------------------------------------------------------------
  // Reusable cube geometry: all tiles instance this
  // ---------------------------------------------------------------------------

  const geometryResult = sceneModel.createGeometry({
    id: "tileBoxGeometry",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: [
      1, 1, 1,  -1, 1, 1,  -1, -1, 1,  1, -1, 1,
      1, 1, 1,   1, -1, 1,  1, -1, -1,  1, 1, -1,
      1, 1, 1,   1, 1, -1,  -1, 1, -1,  -1, 1, 1,
      -1, 1, 1,  -1, 1, -1,  -1, -1, -1,  -1, -1, 1,
      -1, -1, -1,  1, -1, -1,  1, -1, 1,  -1, -1, 1,
      1, -1, -1,  -1, -1, -1,  -1, 1, -1,  1, 1, -1
    ],
    indices: [
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ]
  });

  if (!geometryResult.ok) {
    throw new Error(geometryResult.error);
  }

  // ---------------------------------------------------------------------------
  // Sliding puzzle setup
  // ---------------------------------------------------------------------------

  // A 3x3 "8-puzzle": 8 blocks + 1 empty cell
  const GRID = 3;
  const TILE_SIZE = 3.2;     // distance between cell centers
  const TILE_THICK = 0.8;    // cube thickness (Y scale)
  const TILE_Y = 0;          // puzzle plane height

  // Root transform lets us animate/move the entire puzzle as a group
  const rootTransformResult = sceneModel.createTransform({
    id: "puzzleRoot",
    matrix: xeokit.model.scene.buildMat4({
      position: [OFFSET + 0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    })
  });

  if (!rootTransformResult.ok) {
    throw new Error(rootTransformResult.error);
  }

  const puzzleRoot = rootTransformResult.value;

  // Optional: a "board" transform under root (nice place to rotate/tilt the board only)
  const boardTransformResult = sceneModel.createTransform({
    id: "boardTransform",
    parentTransformId: "puzzleRoot",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  });

  if (!boardTransformResult.ok) {
    throw new Error(boardTransformResult.error);
  }

  const boardTransform = boardTransformResult.value;

  // Convert grid cell (row, col) -> local position under boardTransform
  const cellToPosition = (row, col) => {
    const half = (GRID - 1) / 2;
    const x = (col - half) * TILE_SIZE;
    const z = (row - half) * TILE_SIZE;
    return [x, TILE_Y, z];
  };

  // A simple palette (8 colored tiles)
  const COLORS = [
    [1, 0.2, 0.2],   // red
    [0.2, 1, 0.2],   // green
    [0.2, 0.4, 1],   // blue
    [1, 1, 0.2],     // yellow
    [1, 0.4, 1],     // magenta
    [0.2, 1, 1],     // cyan
    [1, 0.6, 0.2],   // orange
    [0.7, 0.7, 0.7]  // gray
  ];

  // Puzzle state as a flat array of tile IDs in row-major order.
  // null represents the empty slot.
  //
  // Start in a near-solved state, with the empty slot in the middle.
  //  [ 0  1  2
  //    3  _  4
  //    5  6  7 ]
  const state = [
    0, 1, 2,
    3, null, 4,
    5, 6, 7
  ];

  // Create 8 tile transforms + meshes + scene objects
  // Each tile gets:
  //  - a transform (positioned at its current grid cell)
  //  - a mesh (instancing the shared box geometry)
  //  - a scene object (so it’s selectable/groupable as a logical entity)
  const tileTransformIds = new Array(8);
  const tileMeshIds = new Array(8);
  const tileObjectIds = new Array(8);

  for (let tileId = 0; tileId < 8; tileId++) {
    const cellIndex = state.indexOf(tileId);
    const row = Math.floor(cellIndex / GRID);
    const col = cellIndex % GRID;

    const transformId = `tileTransform_${tileId}`;
    const meshId = `tileMesh_${tileId}`;
    const objectId = `tileObject_${tileId}`;

    tileTransformIds[tileId] = transformId;
    tileMeshIds[tileId] = meshId;
    tileObjectIds[tileId] = objectId;

    const tRes = sceneModel.createTransform({
      id: transformId,
      parentTransformId: "boardTransform",
      position: cellToPosition(row, col),
      scale: [1.2, TILE_THICK, 1.2],
      rotation: [0, 0, 0]
    });

    if (!tRes.ok) {
      throw new Error(tRes.error);
    }

    const mRes = sceneModel.createMesh({
      id: meshId,
      geometryId: "tileBoxGeometry",
      parentTransformId: transformId,
      color: COLORS[tileId]
    });

    if (!mRes.ok) {
      throw new Error(mRes.error);
    }

    const oRes = sceneModel.createObject({
      id: objectId,
      meshIds: [meshId]
    });

    if (!oRes.ok) {
      throw new Error(oRes.error);
    }
  }

  // ---------------------------------------------------------------------------
  // Sliding logic + animation: demonstrate dynamic transform updates + hierarchy
  // ---------------------------------------------------------------------------

  const findEmptyIndex = () => state.indexOf(null);

  const getNeighbors = (emptyIndex) => {
    const r = Math.floor(emptyIndex / GRID);
    const c = emptyIndex % GRID;
    const neighbors = [];

    // up/down/left/right
    if (r > 0) neighbors.push(emptyIndex - GRID);
    if (r < GRID - 1) neighbors.push(emptyIndex + GRID);
    if (c > 0) neighbors.push(emptyIndex - 1);
    if (c < GRID - 1) neighbors.push(emptyIndex + 1);

    return neighbors;
  };

  // Animate one tile moving into the empty slot over a short duration
  const moveAnim = {
    active: false,
    tileId: -1,
    from: [0, 0, 0],
    to: [0, 0, 0],
    startTime: 0,
    durationMs: 220
  };

  const startMove = (tileIndex, emptyIndex) => {
    const tileId = state[tileIndex];

    if (tileId === null) return;

    const fromRow = Math.floor(tileIndex / GRID);
    const fromCol = tileIndex % GRID;

    const toRow = Math.floor(emptyIndex / GRID);
    const toCol = emptyIndex % GRID;

    moveAnim.active = true;
    moveAnim.tileId = tileId;
    moveAnim.from = cellToPosition(fromRow, fromCol);
    moveAnim.to = cellToPosition(toRow, toCol);
    moveAnim.startTime = performance.now();

    // Swap in the puzzle state immediately (logical move)
    state[emptyIndex] = tileId;
    state[tileIndex] = null;
  };

  // Pick a random valid move (a random neighbor slides into the empty slot)
  const doRandomMove = () => {
    if (moveAnim.active) return;

    const emptyIndex = findEmptyIndex();
    const neighbors = getNeighbors(emptyIndex);

    const choice = neighbors[Math.floor(Math.random() * neighbors.length)];
    startMove(choice, emptyIndex);
  };

  // Convenience: grab transform instance by tileId
  const getTileTransform = (tileId) => sceneModel.transforms[tileTransformIds[tileId]];

  // A repeating task that:
  //  - animates current tile movement
  //  - periodically triggers a new random move
  //  - rotates the whole puzzle root slightly (shows hierarchy: children follow parent)
  let lastMoveTime = performance.now();

  studio.openInfoPanelFromMeta();
  studio.finished();

  new xeokit.base.core.SDKTask({
    name: "Animate Sliding Puzzle",
    stage: xeokit.base.core.SDKTask.AnimateStage,
    repeat: true,
    task: () => {
      const now = performance.now();

      // 1. Rotate the entire puzzle as a unit (root transform)
      puzzleRoot.rotation = [
        0,
        now / 300,                 // slow Y spin
        Math.sin(now / 1500) * 5   // gentle wobble
      ];

      // 2. Tilt the board back and forth (child of root)
      boardTransform.rotation = [
        Math.sin(now / 1200) * 8,  // tilt X
        0,
        Math.cos(now / 1400) * 8   // tilt Z
      ];

      // Trigger a new random slide periodically
      if (!moveAnim.active && now - lastMoveTime > 450) {
        doRandomMove();
        lastMoveTime = now;
      }

      // 3. Animate the active tile (translation + self-rotation)
      if (moveAnim.active) {
        const t = Math.min(1, (now - moveAnim.startTime) / moveAnim.durationMs);

        // Smoothstep easing
        const eased = t * t * (3 - 2 * t);

        const x = moveAnim.from[0] + (moveAnim.to[0] - moveAnim.from[0]) * eased;
        const y = moveAnim.from[1] + (moveAnim.to[1] - moveAnim.from[1]) * eased;
        const z = moveAnim.from[2] + (moveAnim.to[2] - moveAnim.from[2]) * eased;

        const tileTransform = getTileTransform(moveAnim.tileId);
        if (tileTransform) {
          tileTransform.position = [x, y, z];

          // Spin tile while sliding (local rotation)
          tileTransform.rotation = [
            0,
            eased * 180,                // half-turn while moving
            Math.sin(eased * Math.PI) * 20
          ];
        }

        if (t >= 1) {
          // Snap to final state
          if (tileTransform) {
            tileTransform.position = moveAnim.to;
            tileTransform.rotation = [0, 0, 0];
          }
          moveAnim.active = false;
        }
      }
    }
  }).schedule();
});
