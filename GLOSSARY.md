# Glossary

### AABB

Axis-Aligned Bounding Box

### Annotation

### BASIS

### BCF

BIM Collaboration Format

### BIM

Building Information Modeling

### Bucketing

### Camera

### Converter

### CityJSON

CityJSON is an open standard file format for storing and exchanging 3D city models. It was developed to provide a lightweight, easy-to-use, and interoperable format for representing complex urban environments in 3D.

CityJSON is based on JSON (JavaScript Object Notation), a widely used data interchange format, and is designed to be easily readable and editable by humans. It supports the representation of buildings, roads, trees, water bodies, and other urban elements, as well as metadata such as semantics, textures, and attributes.

CityJSON was developed to address some of the limitations of other 3D city model file formats, such as CityGML and KML, which can be complex and difficult to work with. It is designed to be simple and easy to use, while still providing a rich set of features for representing complex urban environments.

CityJSON has been adopted by a number of cities, organizations, and software vendors as a standard format for 3D city models, and it is supported by a growing number of software tools and libraries. It is also being actively developed and maintained by a community of contributors, ensuring that it continues to evolve and improve over time.

### Control

An SDK component that controls something in the Viewer with mouse or touch input.

See: {@link @xeokit/viewer!CameraControl}

### DataModel

An SDK component that models semantic data as a searchable entity-relationship graph. A DataModel is intended to be used alongside 
a Viewer, to help an application classify and navigate model objects. A DataModel can be built programmatically, 
loaded from an XKT file, and saved within an XKT file.   

See: {@link @xeokit/datamodel!DataModel}

### Data Texture

A data texture is a type of texture used in computer graphics that contains arbitrary data, instead of color or normal information. It can be thought of as a two-dimensional array of values, where each value represents some arbitrary data, such as depth, density, temperature, or any other quantity that can be represented as a scalar value.

Data textures are often used in scientific visualization and simulations, where they can be used to store and display complex data sets, such as medical images, weather data, or fluid simulations. They can also be used for procedural generation of textures and terrain, where the data texture is used to define the parameters of a procedural algorithm that generates the final texture or terrain.

To use a data texture in a computer graphics application, the data is typically encoded as a grayscale image, where each pixel represents a single value in the data texture. The texture can then be applied to a 3D model, and the data values can be used to modify the appearance of the model or to drive a simulation.

Data textures can be combined with other textures, such as color or normal maps, to create more complex and detailed visual effects. They are a powerful tool for creating realistic simulations and visualizations, and are used in a wide range of applications, from scientific research to video games and movies.

### Dolly

### Edges

### Fly-to

### Frustum

SeeL {@link Frustum}

### Geometry

See: {@link Geometry}, {@link GeometryParams}, {@link Model.geometries}, {@link Model.createGeometry}

### Geometry Bucket

See: {@link GeometryBucket}, {@link GeometryCompressedParams}

### glTF

### Highlight

### IFC

Industry Foundation Classes

### Instancing

### Jitter

### KTX2

### LAS

### Memento

### Mesh

### Metadata

See {@link DataModel}

### Metalness

See {@link MeshParams.metallic}, {@link TextureSet.metallicRoughnessTexture}

### OBB

Object-Aligned Bounding Box

See {@link @xeokit/math/boundaries}

### Occlusion Cull

### Open-Closed Principle

Open to extension, closed to modification

### Orthographic

### Pan

### PBR

Physically-Based Rendering

### Perspective

### Pick

### Quantization

Quantization is a process of reducing the precision or number of distinct values of a data signal, while still retaining the most important information. This is done by mapping the original values of a signal to a smaller set of discrete values.

Quantization is commonly used in digital signal processing, image and video compression, and data compression. For example, in image and video compression, quantization is used to reduce the number of bits required to represent an image or video frame.

The process of quantization can result in a loss of information or a loss of fidelity in the signal. This is because the original continuous signal is being approximated by a discrete set of values. The amount of loss depends on the number of quantization levels and the step size between those levels.

There are several types of quantization techniques, including uniform quantization, non-uniform quantization, and scalar quantization. In uniform quantization, the step size between quantization levels is fixed and the same for all values in the signal. In non-uniform quantization, the step size varies depending on the signal value. Scalar quantization is a technique where each sample of the signal is quantized independently of the others.

### Renderer

### Representation

### RTC

### SAO

### SectionPlane

### Select

### Shader

In computer graphics, a shader is a computer program that is used to define the appearance of 3D objects and surfaces in a rendered image or video. Shaders are typically used to create effects like lighting, shadowing, texturing, and colorization.

Shaders are written in a specialized programming language that is designed to run on a graphics processing unit (GPU) rather than a central processing unit (CPU). This allows the GPU to perform highly parallelized computations that are required for real-time rendering of complex 3D scenes.

There are several types of shaders, including vertex shaders, pixel shaders, geometry shaders, and compute shaders. Vertex shaders operate on the vertices of a 3D object, pixel shaders define the color and texture of each pixel, geometry shaders modify the geometry of 3D objects, and compute shaders are used for general-purpose computations on the GPU.

### SOLID

SOLID is an acronym for a set of principles that are designed to help software developers create more maintainable and scalable code. The five principles of SOLID are:

Single Responsibility Principle (SRP): A class should have only one reason to change, meaning that it should have only one responsibility or job.

Open/Closed Principle (OCP): Software entities (classes, modules, functions, etc.) should be open for extension but closed for modification. This means that you should be able to add new functionality to a system without changing the existing code.

Liskov Substitution Principle (LSP): Subtypes should be substitutable for their base types. This means that if a class is derived from another class, it should be able to be used in the same way as the base class without any unexpected behavior.

Interface Segregation Principle (ISP): Clients should not be forced to depend on interfaces they do not use. This means that interfaces should be as small and specific as possible, so that clients only need to implement the methods they actually use.

Dependency Inversion Principle (DIP): High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. Details should depend on abstractions. This means that you should use interfaces or abstract classes to decouple the implementation details from the higher-level code.

These principles are considered best practices in software development, and following them can result in code that is easier to understand, maintain, and scale over time

### Texture

### TextureSet

### Tile

### Transcoder

## Transform

### Translate

### View

An independently-configurable view of the models currently loaded in a Viewer. Each View has its own independent HTML 
canvas. For every ViewerObject within its Viewer, a View automatically maintains a ViewObject to represent and 
control how that ViewObject appears within its canvas.  

### Viewer

### ViewLayer

### ViewObject

### WebGL

WebGL (Web Graphics Library) is a JavaScript API (Application Programming Interface) for rendering interactive 3D graphics and animations within a web browser. It is based on the OpenGL ES (Embedded Systems) 2.0 specification, which is a widely used standard for graphics programming in mobile devices and embedded systems.

WebGL allows web developers to use low-level graphics programming techniques to create high-performance 3D graphics in a web browser without the need for additional plugins or software. It provides access to the computer's graphics hardware and allows developers to create 3D scenes and animations using JavaScript, HTML, and CSS.

WebGL works by creating a 3D rendering context within a web browser, which provides access to the GPU (Graphics Processing Unit) for hardware acceleration of graphics calculations. This allows for smooth and responsive 3D graphics that can be interacted with in real-time.

WebGL has many applications, including video games, virtual and augmented reality, scientific simulations, data visualization, and architectural design. It is supported by most modern web browsers, including Chrome, Firefox, Safari, and Edge, and is used by many popular websites and web applications.

### WebGPU

WebGPU is a low-level graphics API (Application Programming Interface) that provides a way to access the graphics hardware from web applications using JavaScript. It is designed to provide high-performance 3D graphics and computational capabilities to web developers, while also being cross-platform and portable.

WebGPU is based on the modern graphics programming concepts used in other APIs, such as DirectX 12, Vulkan, and Metal, and provides a similar programming model for developers. It is designed to be efficient and flexible, allowing developers to create complex 3D scenes and simulations with high performance and low latency.

WebGPU is still under development and is not yet widely supported by web browsers. However, it is expected to become an important part of the web development landscape in the coming years, as more web applications and games require advanced graphics and computational capabilities.

WebGPU is designed to work with modern web technologies such as WebAssembly, Web Workers, and SharedArrayBuffer, and is expected to provide a more secure and efficient way to access the graphics hardware than previous APIs such as WebGL. It is being developed by a group of industry leaders including Apple, Google, and Mozilla, and is expected to become an important part of the web development ecosystem in the future.

### XKT

The SDK's native binary model file format. TODO

### X-Ray

### xeolabs

### xeogl

### xeokit

