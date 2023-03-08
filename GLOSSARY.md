# Glossary

## AABB

An Axis-Aligned Bounding Box (AABB) is a rectangular cuboid that is aligned with the x, y, and z axes of a 3D coordinate 
system. It is defined by two points: the minimum point, which is the vertex of the cuboid with the lowest x, y, and z 
coordinates, and the maximum point, which is the vertex with the highest x, y, and z coordinates.

The box completely encloses an object in 3D space, and is commonly used in computer graphics to 
represent the minimum volume that contains an object or set of objects. It can also be used for collision detection, 
intersection testing, and other geometric operations.

The figure below shows an example of an axis-aligned 3D bounding box enclosing a 3D model:

[Axis-Aligned 3D Bounding Box Example]()

Note that the bounding boxes in this figure are aligned with the x, y, and z axes of the coordinate system, and its sides 
are parallel to these axes.

## Annotation

## BASIS

## BCF

BIM Collaboration Format

## BIM

Building Information Modeling

## Bucketing

## Camera

## Converter

## CityJSON

CityJSON is an open standard data format for the storage and exchange of 3D city models. It is designed to be 
lightweight and easy to use, while also providing rich semantics and geometry to support a wide range of 
applications. CityJSON is a JSON-based format, which means it is easy to parse and process using modern software tools.

CityJSON was developed by the Dutch national mapping agency, the Kadaster, in collaboration with several other 
organizations, and is now maintained by the OGC (Open Geospatial Consortium) as an official community standard.

CityJSON is capable of representing a wide range of features found in 3D city models, including buildings, streets, 
terrain, vegetation, and more. It supports both geometric and semantic information, allowing users to store detailed 
attributes for each feature, such as height, materials, and function.

CityJSON is gaining popularity in the 3D modeling and GIS (Geographic Information System) communities, and many 
software tools now support its use. It is considered a flexible and efficient format for storing and exchanging 3D 
city models, and has the potential to greatly facilitate the integration of city models into a wide range of 
applications, including urban planning, architecture, and transportation.

## CameraControl

An SDK component that controls something in the Viewer with mouse or touch input.

See: {@link @xeokit/viewer!CameraControl}

## DataModel

An SDK component that models semantic data as a searchable entity-relationship graph. A DataModel is intended to be used alongside 
a Viewer, to help an application classify and navigate model objects. A DataModel can be built programmatically, 
loaded from an XKT file, and saved within an XKT file.   

See: [@xeokit/datamodel!DataModel](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html)

## Data Texture

A data texture is a type of texture used in computer graphics that contains arbitrary data, instead of color or normal 
information. It can be thought of as a two-dimensional array of values, where each value represents some arbitrary data, 
such as depth, density, temperature, or any other quantity that can be represented as a scalar value.

Data textures are often used in scientific visualization and simulations, where they can be used to store and display 
complex data sets, such as medical images, weather data, or fluid simulations. They can also be used for procedural 
generation of textures and terrain, where the data texture is used to define the parameters of a procedural algorithm 
that generates the final texture or terrain.


## Dolly

## Edges

## Fly-to

## Frustum


## Geometry

See: {@link Geometry}, {@link GeometryParams}, {@link Model.geometries}, {@link Model.createGeometry}

## Geometry Bucket

See: {@link GeometryBucket}, {@link GeometryCompressedParams}

## glTF

## Highlight

## IFC

Industry Foundation Classes


## Instancing

## Jitter

---

## KTX2

KTX2 (Khronos Texture 2) is a texture container format developed by the Khronos Group, a non-profit consortium of 
companies focused on the creation of open standards for graphics, media, and parallel computing.

<img src="https://xeokit.github.io/sdk/docs/media/images/xeokit_ktx_logo.svg" width="200px">

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

---

## LAS

**LAS/LAZ** are file formats used for storing and exchanging 3D point cloud data. They are commonly used in the geospatial 
industry, including applications such as LiDAR (Light Detection and Ranging) scanning, aerial photogrammetry, and 
3D mapping.

<img src="https://xeokit.github.io/sdk/docs/media/images/autzen.png" width="400px">

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

---

## Memento

## Mesh

## Metadata

See {@link DataModel}

## Metalness

See {@link MeshParams.metallic}, {@link TextureSet.metallicRoughnessTexture}

## OBB

Object-Aligned Bounding Box

See {@link @xeokit/math/boundaries}

## Occlusion Cull

## Open-Closed Principle

Open to extension, closed to modification

## Orthographic

## Pan

## PBR

Physically-Based Rendering

## Perspective

## Pick

## Quantization

Quantization is a process of reducing the precision or number of distinct values of a data signal, while still retaining the most important information. This is done by mapping the original values of a signal to a smaller set of discrete values.

Quantization is commonly used in digital signal processing, image and video compression, and data compression. For example, in image and video compression, quantization is used to reduce the number of bits required to represent an image or video frame.

The process of quantization can result in a loss of information or a loss of fidelity in the signal. This is because the original continuous signal is being approximated by a discrete set of values. The amount of loss depends on the number of quantization levels and the step size between those levels.

There are several types of quantization techniques, including uniform quantization, non-uniform quantization, and scalar quantization. In uniform quantization, the step size between quantization levels is fixed and the same for all values in the signal. In non-uniform quantization, the step size varies depending on the signal value. Scalar quantization is a technique where each sample of the signal is quantized independently of the others.

## Renderer

## Representation

## RTC

## SAO

## SectionPlane

## Select

## Shader

In computer graphics, a shader is a computer program that is used to define the appearance of 3D objects and surfaces in a rendered image or video. Shaders are typically used to create effects like lighting, shadowing, texturing, and colorization.

Shaders are written in a specialized programming language that is designed to run on a graphics processing unit (GPU) rather than a central processing unit (CPU). This allows the GPU to perform highly parallelized computations that are required for real-time rendering of complex 3D scenes.

There are several types of shaders, including vertex shaders, pixel shaders, geometry shaders, and compute shaders. Vertex shaders operate on the vertices of a 3D object, pixel shaders define the color and texture of each pixel, geometry shaders modify the geometry of 3D objects, and compute shaders are used for general-purpose computations on the GPU.

## SOLID

SOLID is an acronym for a set of principles that are designed to help software developers create more maintainable and scalable code. The five principles of SOLID are:

Single Responsibility Principle (SRP): A class should have only one reason to change, meaning that it should have only one responsibility or job.

Open/Closed Principle (OCP): Software entities (classes, modules, functions, etc.) should be open for extension but closed for modification. This means that you should be able to add new functionality to a system without changing the existing code.

Liskov Substitution Principle (LSP): Subtypes should be substitutable for their base types. This means that if a class is derived from another class, it should be able to be used in the same way as the base class without any unexpected behavior.

Interface Segregation Principle (ISP): Clients should not be forced to depend on interfaces they do not use. This means that interfaces should be as small and specific as possible, so that clients only need to implement the methods they actually use.

Dependency Inversion Principle (DIP): High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. Details should depend on abstractions. This means that you should use interfaces or abstract classes to decouple the implementation details from the higher-level code.

These principles are considered best practices in software development, and following them can result in code that is easier to understand, maintain, and scale over time

## Texture

## TextureSet

## Tile

## Transcoder

## Transform

## Translate

## View

An independently-configurable view of the models currently loaded in a Viewer. Each View has its own independent HTML 
canvas. For every ViewerObject within its Viewer, a View automatically maintains a ViewObject to represent and 
control how that ViewObject appears within its canvas.  

## Viewer

## ViewLayer

## ViewObject

## WebGL

WebGL (Web Graphics Library) is a JavaScript API (Application Programming Interface) for rendering interactive 3D graphics and animations within a web browser. It is based on the OpenGL ES (Embedded Systems) 2.0 specification, which is a widely used standard for graphics programming in mobile devices and embedded systems.

WebGL allows web developers to use low-level graphics programming techniques to create high-performance 3D graphics in a web browser without the need for additional plugins or software. It provides access to the computer's graphics hardware and allows developers to create 3D scenes and animations using JavaScript, HTML, and CSS.

WebGL works by creating a 3D rendering context within a web browser, which provides access to the GPU (Graphics Processing Unit) for hardware acceleration of graphics calculations. This allows for smooth and responsive 3D graphics that can be interacted with in real-time.

WebGL has many applications, including video games, virtual and augmented reality, scientific simulations, data visualization, and architectural design. It is supported by most modern web browsers, including Chrome, Firefox, Safari, and Edge, and is used by many popular websites and web applications.

## WebGPU

WebGPU is a low-level graphics API (Application Programming Interface) that provides a way to access the graphics hardware from web applications using JavaScript. It is designed to provide high-performance 3D graphics and computational capabilities to web developers, while also being cross-platform and portable.

WebGPU is based on the modern graphics programming concepts used in other APIs, such as DirectX 12, Vulkan, and Metal, and provides a similar programming model for developers. It is designed to be efficient and flexible, allowing developers to create complex 3D scenes and simulations with high performance and low latency.

WebGPU is still under development and is not yet widely supported by web browsers. However, it is expected to become an important part of the web development landscape in the coming years, as more web applications and games require advanced graphics and computational capabilities.

WebGPU is designed to work with modern web technologies such as WebAssembly, Web Workers, and SharedArrayBuffer, and is expected to provide a more secure and efficient way to access the graphics hardware than previous APIs such as WebGL. It is being developed by a group of industry leaders including Apple, Google, and Mozilla, and is expected to become an important part of the web development ecosystem in the future.

## XKT

The SDK's native binary model file format. TODO

## X-Ray

## xeolabs

## xeogl

## xeokit

