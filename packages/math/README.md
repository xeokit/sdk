@xeokit/math

Common xeokit math types and utilities.

* **boundaries** - Utility functions for working with 3D and 2D boundaries.
* **compression** - Utility functions for geometry and coordinate de/compression.
* **curves** - Utility functions for working with spline curves.
* **geometry** - Utility functions for generating geometry.
* **rays** - Utility functions for working with 3D rays.
* **rtc** - Utility functions for working with relative-to-center (RTC) coordinates.

### Usage Example

````javascript
import {Viewer} from "@xeokit/viewer";
import * as math from "@xeokit/math";

const viewer = new Viewer();

//...

const aabb = math.boundaries.AABB();
math.boundaries.collapseAABB3(aabb);
math.boundaries.expandAABB3(viewer.scene.aabb);
````
