---
sidebar_position: 1
tags:
  - ifc
  - loaders
---

{% include "components/imports.md" %}

# .ifc loader

## Intro

This TypeScript file demonstrates how to load and interact with an IFC (Industry Foundation Classes) model using the XeoKit SDK. The example includes:

1. Setting up the core XeoKit components:
   - Scene container for geometry and materials
   - Data store for semantic BIM information
   - WebGL renderer for 3D visualization
   - Viewer with camera configuration and controls

2. Loading an IFC model (IfcOpenHouse4) using:
   - IFCLoader to parse the industry-standard IFC format
   - SceneModel for managing 3D geometry
   - DataModel for handling the semantic data layer

3. Demonstrating advanced data querying capabilities:
   - Using `searchObjects` to query specific IFC elements (IfcMember)
   - Filtering by BIM relationships (IfcRelAggregates)
   - Working with the entity-relationship graph structure

4. Visual interaction with the model:
   - Setting up camera position for optimal viewing
   - Implementing interactive camera controls
   - Programmatically selecting elements based on query results

This example showcases XeoKit's ability to handle both the geometric and semantic aspects of BIM models in a web environment.


## Interactive Demo

{% include "components/interactive_example.md" %}

{% include "components/src_content.md" %}

## Other

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque iaculis tellus eu urna fringilla, nec aliquam urna mollis. Nunc orci diam, viverra et ante in, volutpat aliquet sapien. Suspendisse ullamcorper sit amet urna ac vulputate. Cras eu magna rutrum, lobortis urna eget, ultrices arcu. Donec sagittis, massa eu vestibulum faucibus, eros metus tempor nulla, eget viverra mauris velit eu orci. Cras eu mi eu tellus tempus fringilla a nec nunc. Fusce blandit consectetur leo, ut eleifend elit. Proin nec congue lectus, eget efficitur neque. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum a mi in nulla pellentesque interdum. Vivamus imperdiet pharetra nisl a laoreet.
