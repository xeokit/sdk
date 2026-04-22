// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene and rendering APIs used by this example.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create the demo helper. This helper initializes the shared rendering
// context and provides utilities for configuring and running the demo.
const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
    .init()
    .then(() => {

        // Access the Scene created by the DemoHelper. The Scene manages the
        // model content, including geometries, meshes, and objects.
        const { scene } = demoHelper;

        // Create a View with a camera positioned to frame the generated
        // shapes from a slightly elevated angle.
        demoHelper.createView({
            id: "demoView",
            camera: {
                eye: [-0.00, 21.34, 8.54],
                look: [-0.00, -0.00, -0.00],
                up: [0, 0, 1]
            }
        });

        // Create a SceneModel to hold the generated geometries, meshes, and
        // objects used in this example.
        const sceneModelRes = scene.createModel({ id: "simpleShapes" });
        if (!sceneModelRes.ok) {
            throw new Error(sceneModelRes.error);
        }
        const sceneModel = sceneModelRes.value;

        // Define reusable geometries that will be instanced by multiple
        // meshes. This avoids duplicating vertex data for each object.

        // Create a unit cube geometry centered at the origin.
        const boxGeomRes = sceneModel.createGeometry({
            id: "boxGeometry",
            primitive: xeokit.constants.TrianglesPrimitive,
            positions: [
                1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
                1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1
            ],
            indices: [
                0, 1, 2, 0, 2, 3,     // +Z
                4, 7, 6, 4, 6, 5,     // -Z
                4, 5, 1, 4, 1, 0,     // +Y
                3, 2, 6, 3, 6, 7,     // -Y
                0, 3, 7, 0, 7, 4,     // +X
                1, 5, 6, 1, 6, 2      // -X
            ]
        });
        if (!boxGeomRes.ok) {
            throw new Error(boxGeomRes.error);
        }

        // Create a pyramid geometry with a square base and an apex on +Z.
        const pyramidGeomRes = sceneModel.createGeometry({
            id: "pyramidGeometry",
            primitive: xeokit.constants.TrianglesPrimitive,
            positions: [
                -1, -1, 0,
                1, -1, 0,
                1, 1, 0,
                -1, 1, 0,
                0, 0, 1.5
            ],
            indices: [
                0, 1, 2, 0, 2, 3,
                0, 1, 4,
                1, 2, 4,
                2, 3, 4,
                3, 0, 4
            ]
        });
        if (!pyramidGeomRes.ok) {
            throw new Error(pyramidGeomRes.error);
        }

        // Create a helper that generates a simple cylinder geometry aligned
        // to the +Z axis. The side surface is built from quads split into
        // triangles, while the top and bottom are capped with triangle fans.
        const createCylinderGeometry = ({
                                            id,
                                            radius = 1.0,
                                            height = 2.0,
                                            radialSegments = 24
                                        }) => {
            const positions = [];
            const indices = [];

            const halfH = height * 0.5;

            // Add ring vertices for the bottom and top circles.
            for (let i = 0; i < radialSegments; i++) {
                const theta = (i / radialSegments) * Math.PI * 2.0;
                const x = Math.cos(theta) * radius;
                const y = Math.sin(theta) * radius;

                positions.push(x, y, -halfH);
                positions.push(x, y, halfH);
            }

            const bottomCenterIndex = positions.length / 3;
            positions.push(0, 0, -halfH);

            const topCenterIndex = positions.length / 3;
            positions.push(0, 0, halfH);

            // Build the cylinder side faces.
            for (let i = 0; i < radialSegments; i++) {
                const next = (i + 1) % radialSegments;

                const b0 = i * 2;
                const t0 = b0 + 1;
                const b1 = next * 2;
                const t1 = b1 + 1;

                indices.push(b0, b1, t0);
                indices.push(t0, b1, t1);
            }

            // Build the bottom cap with downward-facing winding.
            for (let i = 0; i < radialSegments; i++) {
                const next = (i + 1) % radialSegments;
                const b0 = i * 2;
                const b1 = next * 2;
                indices.push(bottomCenterIndex, b1, b0);
            }

            // Build the top cap with upward-facing winding.
            for (let i = 0; i < radialSegments; i++) {
                const next = (i + 1) % radialSegments;
                const t0 = i * 2 + 1;
                const t1 = next * 2 + 1;
                indices.push(topCenterIndex, t0, t1);
            }

            const geomRes = sceneModel.createGeometry({
                id,
                primitive: xeokit.constants.TrianglesPrimitive,
                positions,
                indices
            });

            if (!geomRes.ok) {
                throw new Error(geomRes.error);
            }
        };

        createCylinderGeometry({
            id: "cylinderGeometry",
            radius: 1.0,
            height: 2.2,
            radialSegments: 28
        });

        // Create a helper that builds one mesh and one object for a given
        // geometry. This keeps object creation concise and consistent.
        const createObjectWithMesh = ({
                                          id,
                                          geometryId,
                                          position,
                                          scale,
                                          color
                                      }) => {

            const meshId = `${id}Mesh`;

            const meshRes = sceneModel.createMesh({
                id: meshId,
                geometryId,
                matrix: xeokit.scene.buildMat4({ position, scale }),
                color
            });

            if (!meshRes.ok) {
                throw new Error(meshRes.error);
            }

            const objRes = sceneModel.createObject({
                id,
                meshIds: [meshId]
            });

            if (!objRes.ok) {
                throw new Error(objRes.error);
            }
        };

        // Create a small set of objects that instance the reusable
        // geometries with different transforms and colors.

        createObjectWithMesh({
            id: "cube",
            geometryId: "boxGeometry",
            position: [-6, 0, 0],
            scale: [2, 2, 2],
            color: [0.2, 0.6, 1.0]
        });

        createObjectWithMesh({
            id: "pyramid",
            geometryId: "pyramidGeometry",
            position: [-2, 0, 0],
            scale: [2, 2, 2],
            color: [1.0, 0.7, 0.2]
        });

        createObjectWithMesh({
            id: "tower",
            geometryId: "boxGeometry",
            position: [2, 0, 0],
            scale: [1.5, 1.5, 5.0],
            color: [0.8, 0.3, 0.9]
        });

        createObjectWithMesh({
            id: "cylinder",
            geometryId: "cylinderGeometry",
            position: [6, 0, 0],
            scale: [2.0, 2.0, 2.0],
            color: [0.3, 0.9, 0.5]
        });

        // Signal that the demo has finished initializing.
        demoHelper.finished();
    });