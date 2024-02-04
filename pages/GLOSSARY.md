[A](#a) - [B](#b) - [C](#c) - [D](#d) - [E](#e) - [F](#f) - [G](#g) - [H](#h) - [I](#i) - [J](#j) - [K](#k) - [L](#l) - [M](#m) - [N](#n) - [O](#o) - [P](#p) - [Q](#q) - [R](#r) - [S](#s) - [T](#t) - [U](#u) - [V](#v) - [X](#x) - [Y](#y) - [Z](#z)

<br>

<img style="padding:50px" src="media://images/xeokit_datamodel_icon.png"/>

<br>

---
# A
---

<br>

## AABB

An Axis-Aligned Bounding Box (AABB) is a rectangular cuboid that is aligned with the x, y, and z axes of a 3D coordinate 
system. It is defined by two points: the minimum point, which is the vertex of the cuboid with the lowest x, y, and z 
coordinates, and the maximum point, which is the vertex with the highest x, y, and z coordinates.

The box completely encloses an object in 3D space, and is commonly used in computer graphics to 
represent the minimum volume that contains an object or set of objects. It can also be used for collision detection, 
intersection testing, and other geometric operations.

The figure below shows an example of a hierarchy of AABB's, that enclose the meshes within a 3D model:

Note that the bounding boxes in this figure are aligned with the x, y, and z axes of the coordinate system, and its sides 
are parallel to these axes.

> *See: [@xeokit/math/boundaries](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_boundaries.html)*

<br>

---
# B
---

<br>

## BCF

The **BIM Collaboration Format** (BCF) is a file format used in Building Information Modeling (BIM) to facilitate 
collaboration between different software applications used by architects, engineers, contractors, and other stakeholders 
in the construction industry.

The BCF file format enables team members to communicate issues, changes, and requests related to the building design 
and construction process. BCF files can include information such as issue descriptions, screenshots, and 3D views, as 
well as metadata such as priority, status, and due dates.

BCF files can be created and read by different BIM software applications, allowing team members to share and collaborate 
on the same issues regardless of the software they are using. This helps to reduce errors, misunderstandings, and delays 
in the construction process.

> *See: [@xeokit/bcf](https://xeokit.github.io/sdk/docs/modules/_xeokit_bcf.html)*

<br>

---
# C
---

<br>

## CityJSON

**CityJSON** is an open standard data format for the storage and exchange of 3D city models. It is designed to be 
lightweight and easy to use, while also providing rich semantics and geometry to support a wide range of 
applications. CityJSON is a JSON-based format, which means it is easy to parse and process using modern software tools.

CityJSON was developed by the Dutch national mapping agency, the Kadaster, in collaboration with several other 
organizations, and is now maintained by the OGC (Open Geospatial Consortium) as an official community standard.

CityJSON is capable of representing a wide range of features found in 3D city models, including buildings, streets, 
terrain, vegetation, and more. It supports both geometric and semantic information, allowing users to store detailed 
attributes for each feature, such as height, materials, and function.

> *See:*
> * [@xeokit/cityjson](https://xeokit.github.io/sdk/docs/modules/_xeokit_cityjson.html)
> * [@xeokit/basictypes/cityJSONTypes_1_1_3](https://xeokit.github.io/sdk/docs/modules/_cityJSONTypes_1_1_3)
 

<br>

## CameraControl

A {@link @xeokit/cameracontrol | CameraControl} is an SDK component that controls a xeokit Viewer's Camera with mouse or touch input.

> *See: [@xeokit/cameracontrol](https://xeokit.github.io/sdk/docs/modules/_xeokit_cameracontrol.html)*

<br>

---
# D
---

<br>

## DataModel

A **[DataModel](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html)** is a semantic entity-relationship graph that's used within the xeokit SDK to represent 
the relationships between entities in a system or domain, where entities are represented as nodes and relationships are 
represented as edges.

In the context of Building Information Modeling (BIM), we can use a representation 
of the relationships between the various elements and components that make up a building or construction project.

BIM software uses a semantic data model to represent different aspects of a building, such as its physical components, 
properties, and relationships. This data can be represented in a graph format where each node represents an entity, such 
as a wall, door, or window, and each edge represents a relationship between those entities, such as a door being 
connected to a wall.

> *See: [@xeokit/data](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html)* 

<br>

## Data Texture

A **data texture** is a type of texture used in computer graphics that contains arbitrary data, instead of color or normal 
information. It can be thought of as a two-dimensional array of values, where each value represents some arbitrary data, 
such as depth, density, temperature, or any other quantity that can be represented as a scalar value.

Data textures are often used in scientific visualization and simulations, where they can be used to store and display 
complex data sets, such as medical images, weather data, or fluid simulations. They can also be used for procedural 
generation of textures and terrain, where the data texture is used to define the parameters of a procedural algorithm 
that generates the final texture or terrain.

> *See: [@xeokit/webglrenderer](https://xeokit.github.io/sdk/docs/modules/_xeokit_webglrenderer.html)*

<br>

## DTX

The SDK's native binary model file format. TODO

---
# E
---

<br>

## Error Objects

**Returning an error object** from a TypeScript function instead of throwing an exception allows the function to gracefully handle errors and communicate
them to the calling code without disrupting the program's flow. This approach enables the calling code to handle the error more effectively and to
make informed decisions about how to proceed. By using error objects, developers can also include additional information about the error, such as
error codes, error messages, and error contexts. Additionally, this approach can make the code more testable and easier to reason about since it
doesn't rely on exceptions that can't be easily caught and mocked during unit testing.

All xeokit functions and methods will return an [SDKError](https://xeokit.github.io/sdk/docs/classes/_xeokit_core_components.SDKError.html) object if something goes wrong. This
enables TypeScript's static checking to insist that we check for the possibility of that SDKError before using any results.

For example:

````javascript
function doSomethingRisky() : SDKError | number {
  // ...
}

const riskyNumber = doSomethingRisky();

// Compiler error because you can't add an Error and a number
const badComputedValue = riskyNumber + 2;

if (riskyNumber instanceof SDKError) {
    console.error(riskyNumber.message);
} else {
    // This is ok as we've guarded against the error case
    const computedValue = riskyNumber + 2;
}
````

> *See [Simple and Maintainable Error Handling in TypeScript](https://dev.to/supermetrics/simple-and-maintainable-error-handling-in-typescript-56lm)*

<br>

---
# F
---

<br>

## Federated Models

TODO

> *See: [@xeokit/data](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html)*

<br>

---
# G
---

<br>

## SceneGeometry Bucketing

TODO

> *See: [@xeokit/scene](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_compression.html)*


<br>

## SceneGeometry Quantization

**SceneGeometry quantization** is a process of reducing the precision of geometry values, while still
retaining the most important information. This is done by mapping the original values of a value to a smaller set
of discrete values.

Quantization is commonly used in digital signal processing, image and video compression, and data compression. For
example, in image and video compression, quantization is used to reduce the number of bits required to represent
an image or video frame.

We use quantization as part of the way we compress geometry in the xeokit SDK. Specifically, we use it to store
32-bit and 64-bit floating point coordinate values as 16-bit integers, which we then decompress dynamically on the
GPU using a de-quantization transform matrix.

> *See: [@xeokit/compression](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_compression.html)*

<br>

## glTF

**glTF** stands for "Graphics Library Transmission Format." It is an open standard file format designed for efficient transmission and loading of 3D models and scenes. Developed by the Khronos Group, glTF is specifically designed to be lightweight, compact, and fast, making it ideal for use in web and real-time applications.

The format supports various 3D asset types, including geometry, materials, textures, animations, and skeletal structures. It uses JSON (JavaScript Object Notation) for storing metadata and binary data for storing the actual 3D model information. This combination allows glTF files to be easily parsed and loaded by web browsers, game engines, and other graphics applications without the need for extensive processing or conversion.

The widespread adoption of glTF has made it a popular choice for sharing 3D content across different platforms, devices, and software, enabling more accessible and interactive experiences for users.

> *See: [@xeokit/gltf](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_compression.html)*

<br>

---
# K
---

<br>

## KTX2

**KTX2 (Khronos SceneTexture 2)** is a texture container format developed by the Khronos Group, a non-profit consortium of 
companies focused on the creation of open standards for graphics, media, and parallel computing.

KTX2 is designed to be a more efficient replacement for the original KTX format, with better compression and faster 
loading times. It supports a wide range of texture formats, including compressed, uncompressed, and block-compressed 
textures. KTX2 also supports multiple levels of detail, which allows textures to be rendered at different resolutions 
depending on their distance from the camera.

One of the key features of KTX2 is its use of the Basis Universal texture codec, which is an open-source, 
high-performance texture compression algorithm developed by Binomial LLC. This codec can compress textures to a smaller 
size than other compression methods while maintaining high visual quality.

KTX2 is widely used in graphics applications, such as games and virtual reality experiences, where fast loading times 
and high-quality textures are important. It is also compatible with many popular graphics APIs, including OpenGL, 
Vulkan, and DirectX.

> *See: [@xeokit/ktx2](https://xeokit.github.io/sdk/docs/modules/_xeokit_ktx2.html)*

<br>

---
# L
---

<br>

## LAS

**LAS/LAZ** are file formats used for storing and exchanging 3D point cloud data. They are commonly used in the geospatial 
industry, including applications such as LiDAR (Light Detection and Ranging) scanning, aerial photogrammetry, and 
3D mapping.

LAS (Log ASCII Standard) is a text-based file format that stores 3D point cloud data in a standard format, with 
each point represented as a row of data that includes attributes such as the x, y, and z coordinates, as well as 
additional information like intensity, color, and classification. LAS files can be easily read and edited by 
various software tools.

LAZ is a compressed version of the LAS format. It uses lossless compression to reduce the size of the file while 
preserving the accuracy and precision of the data. LAZ files can be up to 90% smaller than their uncompressed LAS 
counterparts, making them easier to store and share.

Both LAS and LAZ are widely used in the geospatial industry and are supported by many software tools for processing 
and analyzing 3D point cloud data. Some popular software tools that support LAS/LAZ files include ArcGIS, QGIS, 
Global Mapper, and CloudCompare.

> *See: [@xeokit/las](https://xeokit.github.io/sdk/docs/modules/_xeokit_las.html)*

<br>

---
# M
---

<br>

## Model-View Separation

In the context of a 3D model viewing application, **model-view separation** involves separating the components 
responsible for managing and manipulating the 3D model data (the "model") from the components responsible for rendering 
the model to the user (the "view").

The model (ie. {@link @xeokit/scene!SceneModel | SceneModel}) would contain the data and business logic of the 3D model, 
such as the geometry, texture, and material properties. It would also include any algorithms or mathematical functions 
needed to manipulate the model data, such as transformations or animations.

The view (ie. {@link @xeokit/viewer!Viewer | Viewer}) would be responsible for presenting the 3D model to the user, such 
as by rendering it on a screen or in a virtual reality headset. It would handle tasks such as camera placement, lighting, 
and shading to ensure that the model is displayed accurately and effectively.

In this design pattern, the model and view would be decoupled from each other, allowing for easier maintenance and 
testing of the codebase. Changes to the model would not require changes to the view, and vice versa, which would 
simplify development and reduce the risk of errors. The separation of concerns would also enable the use of different 
views to display the same model, such as a 2D projection for technical drawings or a 3D rendering for immersive visualization.

In xeokit, this separation also means that we can use the model (SceneModel) independently of the view (Viewer), for the 
purposes of generating models and converting model file formats. Usually we would do these sorts of things server-side, 
with no need to involve a Viewer.

> *See: [@xeokit/scene](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html) and [@xeokit/viewer](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html)*

<br>

---
# O
---

<br>

# Occlusion Culling

WebGL occlusion culling is a technique used to improve rendering performance by avoiding the rendering of objects that are not visible to the viewer. The technique works by using a process called frustum culling.

In frustum culling, the WebGL renderer determines which objects are visible to the viewer based on their position and orientation in the 3D scene. It creates a frustum, which is a truncated pyramid that represents the viewer's field of view. Any objects that fall outside the frustum are not visible and can be culled or skipped from the rendering process.

WebGL occlusion culling can further improve performance by using a technique called occlusion testing. In occlusion testing, the renderer checks whether an object is visible by testing whether it is occluded, or hidden, by other objects in the scene. The renderer uses a technique called occlusion queries to determine whether an object is visible or occluded.

Occlusion queries involve rendering a simplified version of the scene to the depth buffer without actually rendering the visible objects. The renderer then checks the depth buffer to determine whether the object is visible or occluded. If the object is occluded, it can be skipped from the rendering process, improving performance

---
# P
---

<br>

## PBR

**Physically-Based Rendering (PBR)** is a computer graphics technique that xeokit uses to render more realistic images of models by 
simulating the physical properties of light and materials. It is based on the laws of physics and uses mathematical 
models to accurately simulate the behavior of light in the real world.

PBR aims to accurately represent the way light interacts with surfaces and materials, taking into account factors such 
as surface roughness, reflectivity, and transparency. By accurately modeling these physical properties, PBR can produce 
quality previews that give a better idea of what models look like in real life.

The xeokit {@link Viewer} uses a *metallic-roughness* PBR shading model that has the following components:

 * A microfacet roughness model 
 * Energy conservation 
 * Metallicity
 * Reflectance Equation - *Cook-Torrance BRDF, Cook-Torrance Specular, Trowbridge-Reitz GGX, Schlick Approximation, Smith’s Method, Fresnel Equation*
 
> *PBR is supported in the following xeokit modules:*
> * *[@xeokit/viewer](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html) - the xeokit Viewer, which supports PBR rendering*
> * *[@xeokit/scene](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html) - the xeokit scene representation, which supports PBR materials*
> * *[@xeokit/dtx](https://xeokit.github.io/sdk/docs/modules/_xeokit_dtx.html) - loads and saves DTX files, which have PBR materials*
> * *[@xeokit/gltf](https://xeokit.github.io/sdk/docs/modules/_xeokit_gltf.html) - loads glTF with PBR materials into xeokit's scene representation* 

<br>

---
# R
---

<br>

## Rounding Jitter

Rounding jitter, demonstrated by rendering a distantly-placed IfcFlowConnector with absolute (non-RTC) coordinates on a standard GPU with 7-digit accuracy.

> *See: [@xeokit/math/rtc](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_rtc.html)*

<div style="display: flex; justify-content: center;">

<img src="https://xeokit.github.io/sdk/assets/images/xeokit-viewer-jitter.png" style="height:250px;">

</div>
<br>

## RTC Coordinates

In a **relative-to-center (RTC) coordinate system** we define the position of each geometry vertex as being relative to 
a given center position. 

RTC is central to xeokit's ability to render models at full precision on low-precision GPUs. To achieve this, we
partition our geometries into regions called *tiles*, with each geometry's vertices being relative to the center of its
tile. When rendering the geometries for each tile, we use a version of the camera's view matrix that's specially modified
using that central position in such a way as to render the half-precision RTC vertices as if they were full-precision absolute values.

RTC is also part of how xeokit keeps a minimal memory footprint. While absolute, double-precision coordinate values
need 64 bits of storage, RTC coordinates only need 16 bits.

> *See: [@xeokit/math/rtc](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_rtc.html)*

<br>

---
# S
---

<br>

## Scene

The xeokit SDK manages model representations in a scene graph that contains the model's objects, geometries and materials. The scene
graph works in both the browser and in NodeJS, and can be used to generate models, convert between model formats, and provide
content for the SDK's model viewer.

> *See: [@xeokit/scene](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html)*

<br>

## SceneModel

A **[SceneModel](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html)** represents a model within a **Scene**.

TODO

> *See: [@xeokit/scene](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html)*

<br>

## SceneObject

A **SceneObject** represents an object within a **SceneModel**.

> *See: [@xeokit/scene](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html)*

<br>

## SectionPlane

A **SectionPlane** is a virtual plane that is used to create a section view of a 3D object. The section plane is a flat, 
transparent plane that is placed through the 3D model of an object at a specific location and orientation.

When a section plane is placed through a 3D object, it creates a section view that shows the interior structure of the 
object as if it has been cut along the plane. The section view provides a more detailed and clear view of the internal 
structure of the object.

> *See:*
> * *[@xeokit/viewer](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html) - View models and slice them open with section planes*
> * *[@xeokit/bcf](https://xeokit.github.io/sdk/docs/modules/_xeokit_bcf.html) - Save and load viewer snapshots as BCF, including section planes* 

<br>

## Shader

In computer graphics, a **shader** is a computer program that is used to define the appearance of 3D objects and surfaces in 
a rendered image or video. Shaders are typically used to create effects like lighting, shadowing, texturing, and colorization.

Shaders are written in a specialized programming language that is designed to run on a graphics processing unit (GPU) 
rather than a central processing unit (CPU). This allows the GPU to perform highly parallelized computations that are 
required for real-time rendering of complex 3D scenes.

There are several types of shaders, including vertex shaders, pixel shaders, geometry shaders, and compute shaders. Vertex 
shaders operate on the vertices of a 3D object, pixel shaders define the color and texture of each pixel, geometry 
shaders modify the geometry of 3D objects, and compute shaders are used for general-purpose computations on the GPU.

<br>

## SOLID

**SOLID** is an acronym for the set of principles that we follow in the design of the xeokit SDK, in order to 
create maintainable and scalable code. The five principles of SOLID are:

 1. **Single Responsibility Principle (SRP)**: A class should have only one reason to change, meaning that it should have 
only one responsibility or job. 
 2. **Open/Closed Principle (OCP)**: Software entities (classes, modules, functions, etc.) should be open for extension but 
closed for modification. This means that you should be able to add new functionality to a system without changing the existing code.
 3. **Liskov Substitution Principle (LSP)**: Subtypes should be substitutable for their base types. This means that if a 
class is derived from another class, it should be able to be used in the same way as the base class without any unexpected behavior.
 4. **Interface Segregation Principle (ISP)**: Clients should not be forced to depend on interfaces they do not use. This 
means that interfaces should be as small and specific as possible, so that clients only need to implement the methods they actually use.
 5. **Dependency Inversion Principle (DIP)**: High-level modules should not depend on low-level modules. Both should depend 
on abstractions. Abstractions should not depend on details. Details should depend on abstractions. This means that you 
should use interfaces or abstract classes to decouple the implementation details from the higher-level code.

These principles are considered best practices in software development, and following them can result in code that is 
easier to understand, maintain, and scale over time.

<br>

## Strongly Typed Events

**Strongly typed events** in TypeScript refer to an approach of defining and handling events in a way that leverages the language's type system
to ensure type safety and better code maintainability. In this approach, events are defined as classes with specific properties and methods,
and event handlers are defined as functions that take the event object as an argument. By using this approach, developers can ensure that event
handlers receive the correct event object with the appropriate properties and types, and they can also easily add, remove, or modify event
handlers. Additionally, this approach allows for better code documentation and IntelliSense support in code editors.

<br>

---
# V
---

<br>

## Viewer

The [**Viewer**](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html) class is the central component of the xeokit SDK. 

In the AECO (Architecture, Engineering, Construction, and Operations) industries, the Viewer can be used in a variety
of ways to help streamline workflows, improve communication, and facilitate collaboration. Here are some examples:

* **Design review and coordination**: Visualize and review 3D models of buildings and
  infrastructure, allowing stakeholders to identify and resolve design conflicts early in the design process.
* **Construction planning and sequencing**: Create 3D visualizations of construction sites,
  helping project teams to plan and sequence construction activities and identify potential safety hazards.
* **Facility management and operations**: View 3D models of facilities and infrastructure,
  allowing operators and maintenance personnel to easily access and visualize information about the assets they manage.
* **Sustainability analysis**: Perform sustainability analysis on building designs, helping
  architects and engineers to optimize energy efficiency and reduce environmental impact.
* **Client presentations**: Create engaging 3D visualizations of building designs and
  infrastructure projects, helping architects, engineers, and contractors to communicate their ideas and designs to
  clients and stakeholders.

> *See: [@xeokit/viewer](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html)*

<br>

## View

A **View** is an independently-configurable view of the models currently loaded in a **Viewer**. Each View has its own 
HTML canvas, lights, {@link @xeokit/viewer!Camera | Camera} and {@link @xeokit/viewer!SectionPlane | SectionPlanes}. A 
View also has a **ViewerObject** for each object loaded in the Viewer, to represent and control how that ViewObject 
appears within its canvas.

> *See: [@xeokit/viewer](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html)*

<br>

## ViewLayer

A **ViewLayer** contains a subset of the [**ViewerObjects**](#viewerobject) within a [**View**](#view). A View usually 
has multiple ViewLayers, so that we can partition our ViewObjects according to their role within the View. For example, 
we might have one ViewLayer that contains building models, and a second ViewLayer that contains background objects, such as 
a skybox or a ground plane. We can then apply visual updates to all building objects as a batch (visibility, opacity, 
colorize etc.) without affecting environment objects, and vice-versa. This feature is particularly useful when 
imporing or exporting Viewer state as [BCF](#bcf).

> *See: [@xeokit/viewer](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html)*

<br>

## ViewObject

A **ViewObject** represents and controls how a single object appears within the HTML canvas managed by 
a **View**. A View automatically has a ViewObject for each object loaded into the viewer, through which we can update and 
query the visual state of that object in the canvas.

<br>

---
# W
---

<br>

## WebGL

WebGL (Web Graphics Library) is a JavaScript API (Application Programming Interface) for rendering interactive 3D 
graphics and animations within a web browser. It is based on the OpenGL ES (Embedded Systems) 2.0 specification, 
which is a widely used standard for graphics programming in mobile devices and embedded systems.

WebGL allows web developers to use low-level graphics programming techniques to create high-performance 3D graphics 
in a web browser without the need for additional plugins or software. It provides access to the computer's graphics 
hardware and allows developers to create 3D scenes and animations using JavaScript, HTML, and CSS.

WebGL works by creating a 3D rendering context within a web browser, which provides access to the 
GPU (Graphics Processing Unit) for hardware acceleration of graphics calculations. This allows for smooth and 
responsive 3D graphics that can be interacted with in real-time.

WebGL has many applications, including video games, virtual and augmented reality, scientific simulations, data 
visualization, and architectural design. It is supported by most modern web browsers, including Chrome, Firefox, 
Safari, and Edge, and is used by many popular websites and web applications.

> *See: [@xeokit/webglrenderer](https://xeokit.github.io/sdk/docs/modules/_xeokit_webglrenderer.html)*

<br>

## WebGPU

WebGPU is a low-level graphics API (Application Programming Interface) that provides a way to access the graphics 
hardware from web applications using JavaScript. It is designed to provide high-performance 3D graphics and 
computational capabilities to web developers, while also being cross-platform and portable.

WebGPU is based on the modern graphics programming concepts used in other APIs, such as DirectX 12, Vulkan, 
and Metal, and provides a similar programming model for developers. It is designed to be efficient and flexible, 
allowing developers to create complex 3D scenes and simulations with high performance and low latency.

WebGPU is designed to work with modern web technologies such as WebAssembly, Web Workers, 
and SharedArrayBuffer, and is expected to provide a more secure and efficient way to access the graphics 
hardware than previous APIs such as WebGL. It is being developed by a group of industry leaders 
including Apple, Google, and Mozilla, and is expected to be an important part of the web 
development ecosystem going forwards.

> *See: [@xeokit/webgpurendererrenderer](https://xeokit.github.io/sdk/docs/modules/_xeokit_webgpurenderer.html)*

<br>

---
# X
---

<br>



> *See: [@xeokit/dtx](https://xeokit.github.io/sdk/docs/modules/_xeokit_dtx.html)*
