# @xeokit

*A complete graphics SDK for browser-based AECO model visualization.*

## Features

* Browser-based 3D/2D viewer
* Fast model loading
* Fast rendering
* Low memory footprint
* Multiple canvases
* Semantic ER data model
* Pluggable graphics engine (WebGL, WebGPU..)
* Natively TypeScript
* SOLID

## Modules

@xeokit is modular:

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|:----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/core`](https://www.npmjs.com/package/@xeokit/core)             | [`@xeokit/core`](./modules/_xeokit_core_components.html)   | Basic component types used throughout the xeokit SDK |
|                                                                          | [`@xeokit/core/constants`](./modules/_xeokit_core_constants.html)     | Constants used throughout the xeokit SDK             |
|                                                                          | [`@xeokit/core/utils`](./modules/_xeokit_core_utils.html)             | Core utilities used throughout the xeokit SDK        |
| [`@xeokit/data`](https://www.npmjs.com/package/@xeokit/data)             | [`@xeokit/data`](./modules/_xeokit_data.html)                         | Viewer-agnostic entity-relationship data model       |
| [`@xeokit/math`](https://www.npmjs.com/package/@xeokit/math)             | [`@xeokit/math/math`](./modules/_xeokit_math_math.html)               | General math definitions and constants               |
|                                                                          | [`@xeokit/math/boundaries`](./modules/_xeokit_math_boundaries.html)   | Boundaries math library                              |
|                                                                          | [`@xeokit/math/compression`](./modules/_xeokit_math_compression.html) | Geometry de/compression utilities library            |
|                                                                          | [`@xeokit/math/curves`](./modules/_xeokit_math_curves.html)           | Spline curves math library                           |
|                                                                          | [`@xeokit/math/geometry`](./modules/_xeokit_math_geometry.html)       | Mesh generation functions                            |
|                                                                          | [`@xeokit/math/matrix`](./modules/_xeokit_math_matrix.html)           | Matrix and vector math utilities library             |
|                                                                          | [`@xeokit/math/rtc`](./modules/_xeokit_math_rtc.html)                 | Relative-to-center (RTC) coordinates math library    |
| [`@xeokit/scene`](https://www.npmjs.com/package/@xeokit/scene) | [`@xeokit/scene`](./modules/_xeokit_model.html)                | Viewer-agnostic model representation                 |
| [`@xeokit/viewer`](https://www.npmjs.com/package/@xeokit/viewer)         | [`@xeokit/viewer`](./modules/_xeokit_viewer.html)                     | Browser-based model viewer                           |
| [`@xeokit/webglrenderer`](https://www.npmjs.com/package/@xeokit/webglrenderer)           | [`@xeokit/webglrenderer`](./modules/_xeokit_webgl.html)                       | Configures the viewer to use WebGL2                  |
| [`@xeokit/dtx`](https://www.npmjs.com/package/@xeokit/dtx)               | [`@xeokit/dtx`](./modules/_xeokit_dtx.html)                           | Import and export XKT files                          |
| [`@xeokit/gltf`](https://www.npmjs.com/package/@xeokit/gltf)             | [`@xeokit/gltf`](./modules/_xeokit_gltf.html)                         | Import and export glTF files                         |
| [`@xeokit/las`](https://www.npmjs.com/package/@xeokit/las)               | [`@xeokit/las`](./modules/_xeokit_las.html)                           | Import LAS pointcloud scans                          |
| [`@xeokit/cityjson`](https://www.npmjs.com/package/@xeokit/cityjson)     | [`@xeokit/las`](./modules/_xeokit_cityjson.html)                      | Import CityJSON files                                |

## Getting Started

TODO

## Concepts

### SOLID

In software engineering, SOLID is a mnemonic acronym for five design principles intended to make object-oriented designs
more understandable, flexible, and maintainable.

* **S**ingle responsibility
* **O**pen-closed principle
* **L**iskove substitution principle
* **I**nterface seggregation principle
* **D**ependency inversion principle

S - @xeokit/data knows nothing of viewer etc, divided geometry functions into @xeokit/compression and @xeokit/compression/texture, with allows the documentation for each package to focus on its own techniques.
O - factoring all internally-used utlity libraries out into their own public libraries
L - ViewerModel and ScratchModel both implement interfaces SceneModel, which enables us to load and save TODO  
I -
D - Viewer and WebGLRenderer

## License

Copyright 2020, AGPL3 License.

## Credits

See [*Credits*](/credits.html).
