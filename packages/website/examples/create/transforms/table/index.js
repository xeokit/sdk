// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene and rendering APIs used by this example.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared rendering
// context and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({ renderer: "webgl" });

// Define a large world-space offset. This is used to position the model
// far from the origin while keeping its local transforms simple.
const OFFSET = 100000;

studio
    .init()
    .then(() => {

        // Access the Scene created by the Studio.
        // The Scene manages renderable content used by the example.
        const { scene } = studio;

        // Create a View with a camera positioned to frame the offset model
        // from an elevated perspective.
        studio.viewManager.createView({
            camera: {
                eye: [OFFSET + 10, 25, 2],
                look: [OFFSET + 0, 0, -6],
                up: [0, 0, 1]
            }
        });

        // Create a SceneModel to hold the geometry, transforms, and meshes
        // used to render the table model.
        const sceneModelResult = scene.createModel({
            id: "demoModel",
            coordinateSystem: {
              basis: [
                1, 0, 0, // Right
                0, 1, 0, // Up
                0, 0, 1  // Forward
              ],
              origin: [0, 0, 0],
              units: "meters"
            }
        });

        if (!sceneModelResult.ok) {
            throw new Error(sceneModelResult.error);
        }

        const sceneModel = sceneModelResult.value;

        // Create a reusable box geometry. This single geometry is instanced
        // by the tabletop and each table leg.
        const geometryResult = sceneModel.createGeometry({
            id: "demoBoxGeometry",
            primitive: xeokit.base.constants.TrianglesPrimitive,
            positions: [
                1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1,
                1, -1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1,
                -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1,
                -1, -1, -1, -1, -1, 1, -1, 1, 1, -1,
            ],
            indices: [
                0, 1, 2, 0, 2, 3,
                4, 5, 6, 4, 6, 7,
                8, 9, 10, 8, 10, 11,
                12, 13, 14, 12, 14, 15,
                16, 17, 18, 16, 18, 19,
                20, 21, 22, 20, 22, 23,
            ],
        });

        if (!geometryResult.ok) {
            throw new Error(geometryResult.error);
        }

        // Create a root transform that applies the global model offset. All
        // child transforms inherit from this transform.
        const t1Result = sceneModel.createTransform({
            id: "rootTransform",
            matrix: xeokit.model.scene.buildMat4({
                position: [OFFSET + 0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
            }),
        });

        if (!t1Result.ok) {
            throw new Error(t1Result.error);
        }

        const rootTransform = t1Result.value;

        // Create a transform for the red leg. This defines the leg position
        // and scale relative to the root transform.
        const t2Result = sceneModel.createTransform({
            id: "redLegTransform",
            parentTransformId: "rootTransform",
            position: [-4, -6, -4],
            rotation: [0, 0, 0],
            scale: [1, 3, 1]
        });

        if (!t2Result.ok) {
            throw new Error(t2Result.error);
        }

        // Create a red mesh that instances the shared box geometry using
        // the red leg transform.
        const m1Result = sceneModel.createMesh({
            id: "redLegMesh",
            geometryId: "demoBoxGeometry",
            parentTransformId: "redLegTransform",
            color: [1, 0, 0],
            opacity: 0.2
        });

        if (!m1Result.ok) {
            throw new Error(m1Result.error);
        }

        // Create a transform for the green leg.
        const t3Result = sceneModel.createTransform({
            id: "greenLegTransform",
            parentTransformId: "rootTransform",
            position: [4, -6, -4],
            rotation: [0, 0, 0],
            scale: [1, 3, 1]
        });

        if (!t3Result.ok) {
            throw new Error(t3Result.error);
        }

        // Create a green mesh that instances the shared box geometry using
        // the green leg transform.
        const m2Result = sceneModel.createMesh({
            id: "greenLegMesh",
            geometryId: "demoBoxGeometry",
            parentTransformId: "greenLegTransform",
            color: [0, 1, 0]
        });

        if (!m2Result.ok) {
            throw new Error(m2Result.error);
        }

        // Create a transform for the blue leg.
        const t4Result = sceneModel.createTransform({
            id: "blueLegTransform",
            parentTransformId: "rootTransform",
            position: [4, -6, 4],
            rotation: [0, 0, 0],
            scale: [1, 3, 1]
        });

        if (!t4Result.ok) {
            throw new Error(t4Result.error);
        }

        const blueLegTransform = t4Result.value;

        // Create a blue mesh that instances the shared box geometry using
        // the blue leg transform.
        const m3Result = sceneModel.createMesh({
            id: "blueLegMesh",
            geometryId: "demoBoxGeometry",
            parentTransformId: "blueLegTransform",
            color: [0, 0, 1]
        });

        if (!m3Result.ok) {
            throw new Error(m3Result.error);
        }

        // Create a transform for the yellow leg. The rotation is then
        // updated explicitly after creation.
        const t5Result = sceneModel.createTransform({
            id: "yellowLegTransform",
            parentTransformId: "rootTransform",
            position: [-4, -6, 4],
            rotation: [0, 0, 0],
            scale: [1, 3, 1]
        });

        if (!t5Result.ok) {
            throw new Error(t5Result.error);
        }

        t5Result.value.rotation = [0, 40, 0];

        // Create a yellow mesh that instances the shared box geometry using
        // the yellow leg transform.
        const m4Result = sceneModel.createMesh({
            id: "yellowLegMesh",
            geometryId: "demoBoxGeometry",
            parentTransformId: "yellowLegTransform",
            color: [1, 1, 0]
        });

        if (!m4Result.ok) {
            throw new Error(m4Result.error);
        }

        // Create a transform for the tabletop. This scales the shared box
        // geometry into a wide, thin surface.
        const t6Result = sceneModel.createTransform({
            id: "tableTopTransform",
            parentTransformId: "rootTransform",
            position: [0, -3, 0],
            scale: [6, 0.5, 6]
        });

        if (!t6Result.ok) {
            throw new Error(t6Result.error);
        }

        // Create the tabletop mesh as another instance of the same box
        // geometry with its own transform and color.
        const m5Result = sceneModel.createMesh({
            id: "purpleTableTopMesh",
            geometryId: "demoBoxGeometry",
            parentTransformId: "tableTopTransform",
            color: [1.0, 0.3, 1.0],
        });

        if (!m5Result.ok) {
            throw new Error(m5Result.error);
        }

        // Signal that the demo has finished initializing.
        studio.openInfoPanelFromMeta();
        studio.finished();

    });
