import * as xeokit from "./xeokit-demo-bundle.js";

/**
 * Helper utility for xeokit demo applications.
 *
 * `DemoHelper` centralizes common demo setup logic by creating and wiring together
 * the core xeokit subsystems used in examples:
 *
 * - {@link scene!Scene | Scene} – renderable scene graph
 * - {@link data!Data | Data} – semantic data graph
 * - {@link viewer!Viewer | Viewer} – view and camera management
 * - {@link webglrenderer!WebGLRenderer | WebGLRenderer} – WebGL rendering backend
 *
 * It also:
 *
 * - Attaches components in the correct order
 * - Logs lifecycle and error events from each subsystem to the console
 * - Signals when a demo has finished initializing for test harnesses and documentation tooling
 *
 * `DemoHelper` is intended for **examples and demos only**. It is not required for
 * normal SDK usage and does not add functionality beyond convenience and diagnostics.
 *
 * @example
 * ```ts
 * const demoHelper = new DemoHelper();
 *
 * demoHelper.init().then(({ scene, data, viewer, renderer }) => {
 *   // Build DataModels and SceneModels here
 *   demoHelper.finished();
 * });
 * ```
 */
export class DemoHelper {

  /**
   * Creates a DemoHelper.
   * @param cfg
   * @param {boolean} [cfg.makeComponents=true] Whether to create the boilerplate set of core xeokit components. True by default.
   */
    constructor(cfg = {}) {
        this.makeComponents = cfg.makeComponents !== false;
        this.startTime = null;
    }

  /**
   * Initializes the core xeokit components and wires them together.
   * Returns a Promise that resolves to an object containing the created components.
   * @param cfg
   * @returns {Promise<unknown>}
   */
    init(cfg={}) {

        return new Promise((resolve, reject) => {

          this.startTime = performance.now();

          if (this.makeComponents) {

            // Create the main xeokit components

            const scene = new xeokit.scene.Scene();
            const data = new xeokit.data.Data();
            const viewer = new xeokit.viewer.Viewer();
            const renderer = new xeokit.webglrenderer.WebGLRenderer();

            if (cfg.logging !== false) {

              // Log any errors to the console.

              new xeokit.core.EventsLogger(scene.events, {prefix: `[Scene    ]`});
              new xeokit.core.EventsLogger(data.events, {prefix: `[Data     ]`});
              new xeokit.core.EventsLogger(viewer.events, {prefix: `[Viewer   ]`});
              new xeokit.core.EventsLogger(renderer.events, {prefix: `[Renderer ]`});

            }
            // Attach components to each other

            viewer.attachScene(scene);
            renderer.attachViewer(viewer);

            const viewResult = viewer.createView({
              id: "demoView",
              elementId: "demoCanvas"
            });

            if (!viewResult.ok) {
              return;
            }

            const view = viewResult.value;

            new xeokit.cameracontrol.CameraControl(view);

            resolve({
              data,
              scene,
              viewer,
              view,
              renderer
            });
          } else {
            resolve({});
          }
        });
    }

    finished() {
        let endTime = performance.now();  // Get the precise ending time
        let elapsedTime = endTime - this.startTime;  // Calculate the elapsed time

      this.#signalFinished();
    }

    #signalFinished() {
        const div = document.createElement("div");
        div.id = "ExampleLoaded";
        document.body.appendChild(div);
    }
}
