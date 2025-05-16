---
sidebar_position: 1
tags:
  - .bim
  - loaders
---

{% include "components/imports.md" %}

# .bim loader

## Intro

This TypeScript file demonstrates how to load and display a 3D BIM (Building Information Modeling) model using the XeoKit SDK. The example specifically shows:


1. Setting up a complete XeoKit viewer with necessary components:

- Scene for managing geometry and materials
- Data store for semantic information
- WebGL renderer for graphics processing
- Camera configuration with proper orientation (Z-axis up)

2. Loading a .BIM format model (BlenderHouse) from a remote URL using:

- DotBIMLoader to parse the BIM file format
- SceneModel to hold the 3D geometry
- DataModel to store associated metadata

3. Implementation of camera controls for interactive navigation

This example demonstrates XeoKit's component-based architecture and the separation of concerns between geometry rendering and semantic data management, which is essential for working with BIM models.

## Interactive Demo

{% include "components/interactive_example.md" %}

{% include "components/src_content.md" %}

## Other

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque iaculis tellus eu urna fringilla, nec aliquam urna mollis. Nunc orci diam, viverra et ante in, volutpat aliquet sapien. Suspendisse ullamcorper sit amet urna ac vulputate. Cras eu magna rutrum, lobortis urna eget, ultrices arcu. Donec sagittis, massa eu vestibulum faucibus, eros metus tempor nulla, eget viverra mauris velit eu orci. Cras eu mi eu tellus tempus fringilla a nec nunc. Fusce blandit consectetur leo, ut eleifend elit. Proin nec congue lectus, eget efficitur neque. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum a mi in nulla pellentesque interdum. Vivamus imperdiet pharetra nisl a laoreet.
