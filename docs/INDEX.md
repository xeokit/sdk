# @xeokit

[![Latest NPM release](https://img.shields.io/npm/v/@xeokit-sdk/core.svg)](https://www.npmjs.com/package/@xeokit-sdk/core)
[![Minzipped size](https://badgen.net/bundlephobia/minzip/@xeokit-sdk/core)](https://bundlephobia.com/result?p=@xeokit-sdk/core)
[![License](https://img.shields.io/badge/license-MIT-007ec6.svg)](https://github.com/xeolabs/xeokit-sdk/blob/master/LICENSE)

*Graphics SDK for browser-based AECO visualization.*

## Features

* Browser-based 3D/2D viewer from [@xeolabs](https://xeolabs.com)
* For BIM & AEC applications
* Fast rendering
* Compact memory footprint
* Multiple canvases
* Semantic ER data model
* Pluggable graphics (WebGL, WebGPU..)
* Natively TypeScript

## Modules

@xeokit is modular:

| Package                                                                      | Modules                                                               | Description                                       |
|------------------------------------------------------------------------------|:----------------------------------------------------------------------|---------------------------------------------------|
| [`@xeokit/core`](https://www.npmjs.com/package/@xeokit/core)                 | [`@xeokit/core/components`](./modules/_xeokit_core_components.html)   | Component types used throughout the xeokit SDK    |
|                                                                              | [`@xeokit/core/constants`](./modules/_xeokit_core_constants.html)     | Constants used throughout the xeokit SDK          |
|                                                                              | [`@xeokit/core/utils`](./modules/_xeokit_core_utils.html)             | Core utilities used throughout the xeokit SDK     |
| [`@xeokit/data`](https://www.npmjs.com/package/@xeokit/data)                 | [`@xeokit/data`](./modules/_xeokit_data.html)                         | Entity-relationship data model                    |
| [`@xeokit/math`](https://www.npmjs.com/package/@xeokit/math)                 | [`@xeokit/math/math`](./modules/_xeokit_math_math.html)               | General math definitions and constants            |
|                                                                              | [`@xeokit/math/boundaries`](./modules/_xeokit_math_boundaries.html)   | Boundaries math library                           |
|                                                                              | [`@xeokit/math/compression`](./modules/_xeokit_math_compression.html) | Geometry de/compression utilities library         |
|                                                                              | [`@xeokit/math/curves`](./modules/_xeokit_math_curves.html)           | Spline curves math library                        |
|                                                                              | [`@xeokit/math/geometry`](./modules/_xeokit_math_geometry.html)       | Mesh generation functions                         |
|                                                                              | [`@xeokit/math/matrix`](./modules/_xeokit_math_matrix.html)           | Matrix and vector math utilities library          |
|                                                                              | [`@xeokit/math/rtc`](./modules/_xeokit_math_rtc.html)                 | Relative-to-center (RTC) coordinates math library |
| [`@xeokit/scratchmodel`](https://www.npmjs.com/package/@xeokit/scratchmodel) | [`@xeokit/scratchmodel`](./modules/_xeokit_model.html)                | Viewer-agnostic model representation              |
| [`@xeokit/viewer`](https://www.npmjs.com/package/@xeokit/viewer)             | [`@xeokit/viewer`](./modules/_xeokit_viewer.html)                     | Browser-based model viewer                        |
| [`@xeokit/webgl`](https://www.npmjs.com/package/@xeokit/webgl)               | [`@xeokit/webgl`](./modules/_xeokit_webgl.html)                       | Configures the viewer to use WebGL2               |
| [`@xeokit/xkt`](https://www.npmjs.com/package/@xeokit/xkt)                   | [`@xeokit/xkt`](./modules/_xeokit_xkt.html)                           | Import and export XKT files                       |
| [`@xeokit/gltf`](https://www.npmjs.com/package/@xeokit/gltf)                 | [`@xeokit/gltf`](./modules/_xeokit_gltf.html)                         | Import and export glTF files                      |
| [`@xeokit/las`](https://www.npmjs.com/package/@xeokit/las)                   | [`@xeokit/las`](./modules/_xeokit_las.html)                           | Import LAS pointcloud scans                       |

## Getting Started

TODO

## Concepts

TODO

## License

Copyright 2020, AGPL3 License.

## Credits

See [*Credits*](/credits.html).
